"use server";
import { pool } from "@/db";
import { requireUser } from "./auth";
import { hashPassword } from "./password";
import { ROLES } from "./permissions";
import { requireUuid } from "./validation";
import { revalidatePath } from "next/cache";
export async function manageAccount(_previous:{ok:boolean;message:string},form:FormData){
 const actor=await requireUser("accounts");
 const value=(key:string)=>String(form.get(key)??"").trim();const kind=value("kind");
 if(!["create","reset","disable","enable","role"].includes(kind))return {ok:false,message:"Unknown account action."};
 const c=await pool.connect();
 try{
  await c.query("begin");
  await c.query("select pg_advisory_xact_lock(872401)");
  let id=value("userId");
  if(kind==="create"){
   const email=value("email").toLowerCase();const role=value("role");const partyId=value("partyId")||null;
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new Error("Enter a valid email address.");
   if(!ROLES.some(r=>r===role))throw new Error("Invalid role.");
   if(role==="student"||role==="trainer"){
    requireUuid(partyId,"profile");
    const found=await c.query("select 1 from party where id=$1 and $2=any(roles)",[partyId,role]);if(!found.rowCount)throw new Error("Select a matching student or trainer profile.");
   }else if(partyId)requireUuid(partyId,"profile");
   const hash=await hashPassword(String(form.get("password")??""));
   const rows=await c.query("insert into app_user(email,role,party_id) values($1,$2,$3) returning id",[email,role,partyId]);id=rows.rows[0].id;
   await c.query("insert into auth_credential(user_id,password_hash) values($1,$2)",[id,hash]);
  }else{
   requireUuid(id,"account");
   if(id===actor.id)throw new Error("Use Account to change your own password. Another manager must change your role or access.");
   const found=await c.query("select u.role from app_user u join auth_credential c on c.user_id=u.id where u.id=$1 for update of u",[id]);if(!found.rowCount)throw new Error("Account not found.");
   if(kind==="reset"){
    const hash=await hashPassword(String(form.get("password")??""));await c.query("update auth_credential set password_hash=$1,must_change=true where user_id=$2",[hash,id]);
   }else if(kind==="role"){
    const role=value("role");const partyId=value("partyId")||null;if(!ROLES.some(r=>r===role))throw new Error("Invalid role.");
    if(role==="student"||role==="trainer"){requireUuid(partyId,"profile");if(!(await c.query("select 1 from party where id=$1 and $2=any(roles)",[partyId,role])).rowCount)throw new Error("Select a matching profile.");}
    await c.query("update app_user set role=$1,party_id=$2 where id=$3",[role,partyId,id]);
   }else await c.query("update auth_credential set disabled=$1 where user_id=$2",[kind==="disable",id]);
   await c.query("delete from auth_session where user_id=$1",[id]);
  }
  await c.query("insert into ledger_event(actor_id,event_type,entity_type,entity_id,payload) values($1,$2,'app_user',$3,$4)",[actor.id,kind==="create"?"account.created":"account.updated",id,JSON.stringify({operation:kind})]);
  await c.query("commit");
 }catch(error){await c.query("rollback");const e=error as Error&{code?:string};return {ok:false,message:e.code?"Unable to save. Check the account email and selected profile.":e.message};}finally{c.release();}
 revalidatePath("/accounts");return {ok:true,message:"Account saved. Share temporary credentials privately; password change is required."};
}
