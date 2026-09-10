"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { pool } from "@/db";
import { currentUser, SESSION_COOKIE, takeQuota, tokenHash } from "./auth";
import { hashPassword, verifyPassword, generateTempPassword } from "./password";
import { homeFor } from "./permissions";
import { sendPasswordResetEmail } from "./email";
export async function login(_previous: {error:string}, form:FormData) {
 const email=String(form.get("email")??"").trim().toLowerCase();
 const password=String(form.get("password")??"");
 if (!email || email.length>254 || !password || password.length>128) return {error:"Enter a valid email and password."};
 let target="/";
 try {
  if (!await takeQuota("login:global",200,60) || !await takeQuota(`login:${email}`,10,900)) return {error:"Too many attempts. Try again in 15 minutes."};
  const {rows}=await pool.query(`select u.id,u.role,c.password_hash,c.disabled,c.must_change from app_user u join auth_credential c on c.user_id=u.id where lower(u.email)=$1`,[email]);
  const user=rows[0];
  const valid=await verifyPassword(password,user?.password_hash ?? "00000000000000000000000000000000:"+"00".repeat(64));
  if (!user || !valid || user.disabled) return {error:"Email or password is incorrect."};
  const jar=await cookies();
  const old=jar.get(SESSION_COOKIE)?.value;
  const token=randomBytes(32).toString("hex");
  const client=await pool.connect();
  try {
   await client.query("begin");
   if(old) await client.query("delete from auth_session where token_hash=$1",[tokenHash(old)]);
   await client.query("insert into auth_session(token_hash,user_id,expires_at) values($1,$2,now()+interval '8 hours')",[tokenHash(token),user.id]);
   await client.query("commit");
  } catch(e) {await client.query("rollback");throw e;} finally{client.release();}
  jar.set(SESSION_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:8*3600});
  target=user.must_change?"/account":homeFor(user.role);
 } catch { return {error:"Sign-in is unavailable. Please try again."}; }
 redirect(target);
}
// Deliberately returns the SAME message whether or not the email is
// enrolled, and on any internal failure -- so this endpoint can't be used
// to enumerate which emails have accounts (same reasoning as login()'s
// dummy-hash comparison). The real outcome (sent / not sent / erred) is
// only distinguishable by whether an email actually arrives.
const RESET_MESSAGE = "If that email is registered, a new temporary password has been sent to it.";
export async function requestPasswordReset(_previous: {error:string;sent:boolean}, form:FormData) {
 const email=String(form.get("email")??"").trim().toLowerCase();
 if (!email || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return {error:"Enter a valid email address.",sent:false};
 try {
  if (!await takeQuota("reset:global",100,60) || !await takeQuota(`reset:${email}`,3,900)) return {error:"Too many attempts. Try again in 15 minutes.",sent:false};
  const {rows}=await pool.query(`select u.id from app_user u join auth_credential c on c.user_id=u.id where lower(u.email)=$1 and not c.disabled`,[email]);
  const user=rows[0];
  if (user) {
   const tempPassword=generateTempPassword();
   const hash=await hashPassword(tempPassword);
   const client=await pool.connect();
   try {
    await client.query("begin");
    await client.query("update auth_credential set password_hash=$1,must_change=true where user_id=$2",[hash,user.id]);
    await client.query("delete from auth_session where user_id=$1",[user.id]);
    await client.query("delete from password_reset where user_id=$1",[user.id]);
    await client.query("insert into ledger_event(actor_id,event_type,entity_type,entity_id) values(null,'password.reset_requested','app_user',$1)",[user.id]);
    await client.query("commit");
   } catch(e) {await client.query("rollback");throw e;} finally{client.release();}
   // Sending the email is best-effort from the caller's point of view (the
   // response never reveals whether it succeeded), but a real failure is
   // still logged server-side so an admin can notice delivery is broken.
   await sendPasswordResetEmail(email,tempPassword).catch((e)=>{console.error("[password-reset] email send failed:",e instanceof Error?e.message:e);});
  }
 } catch (e) { console.error("[password-reset] failed:",e instanceof Error?e.message:e); }
 return {error:"",sent:true,message:RESET_MESSAGE} as {error:string;sent:boolean;message?:string};
}
export async function logout() {
 const jar=await cookies();const token=jar.get(SESSION_COOKIE)?.value;
 if(token) await pool.query("delete from auth_session where token_hash=$1",[tokenHash(token)]);
 jar.delete(SESSION_COOKIE);redirect("/login");
}
export async function changePassword(_previous:{error:string},form:FormData) {
 const user=await currentUser();if(!user) redirect("/login");
 const old=String(form.get("currentPassword")??"");const password=String(form.get("newPassword")??"");
 if(password!==form.get("confirmPassword")) return {error:"New passwords do not match."};
 if(old===password) return {error:"Choose a different password."};
 if(!await takeQuota(`password:${user.id}`,10,900)) return {error:"Too many attempts. Try again later."};
 const {rows}=await pool.query("select password_hash from auth_credential where user_id=$1",[user.id]);
 if(!await verifyPassword(old,rows[0].password_hash)) return {error:"Current password is incorrect."};
 let hash:string;try{hash=await hashPassword(password);}catch(e){return {error:(e as Error).message};}
 const client=await pool.connect();
 try {
  await client.query("begin");
  await client.query("update auth_credential set password_hash=$1,must_change=false where user_id=$2",[hash,user.id]);
  await client.query("delete from auth_session where user_id=$1",[user.id]);
  await client.query("insert into ledger_event(actor_id,event_type,entity_type,entity_id) values($1,'password.changed','app_user',$1)",[user.id]);
  await client.query("commit");
 } catch(e){await client.query("rollback");throw e;} finally{client.release();}
 (await cookies()).delete(SESSION_COOKIE);redirect("/login?changed=1");
}
