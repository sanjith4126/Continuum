import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { pool } from "@/db";
import { can, type Permission, type Role } from "./permissions";
export const SESSION_COOKIE = "continuum_session";
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export type User = {id:string; email:string; role:Role; partyId:string|null; name:string; mustChange:boolean};
export async function currentUser(): Promise<User|null> {
 const token = (await cookies()).get(SESSION_COOKIE)?.value;
 if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
 const result = await pool.query(`select u.id,u.email,u.role,u.party_id as "partyId",coalesce(p.name,u.email) as name,c.must_change as "mustChange"
 from auth_session s join app_user u on u.id=s.user_id join auth_credential c on c.user_id=u.id
 left join party p on p.id=u.party_id where s.token_hash=$1 and s.expires_at>now() and not c.disabled`,[tokenHash(token)]);
 return result.rows[0] ?? null;
}
export async function requireUser(permission?: Permission) {
 const user = await currentUser();
 if (!user) redirect("/login");
 if (user.mustChange) redirect("/account");
 if (permission && !can(user.role,permission)) redirect("/forbidden");
 return user;
}
// Atomic counters live in PostgreSQL, so limits hold across processes/deployments.
export async function takeQuota(key:string,limit:number,seconds:number) {
 const result=await pool.query(`insert into request_bucket(key,hits,expires_at) values($1,1,now()+$2*interval '1 second')
 on conflict(key) do update set hits=case when request_bucket.expires_at<now() then 1 else request_bucket.hits+1 end,
 expires_at=case when request_bucket.expires_at<now() then excluded.expires_at else request_bucket.expires_at end returning hits`,[tokenHash(key),seconds]);
 return result.rows[0].hits<=limit;
}
