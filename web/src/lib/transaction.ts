import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireUser, type User } from "./auth";
import type { Permission } from "./permissions";
export type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
const context=new AsyncLocalStorage<{tx:Tx;user:User}>();
export async function authorizedTransaction<T>(permission:Permission,fn:(tx:Tx,user:User)=>Promise<T>):Promise<T>{
 const user=await requireUser(permission);
 const existing=context.getStore();
 if(existing) {if(existing.user.id!==user.id)throw new Error("Session changed.");return fn(existing.tx,user);}
 return db.transaction(async tx=>{
  await tx.execute(sql`set local role continuum_staff`);
  await tx.execute(sql`select set_config('app.user_role',${user.role},true),set_config('app.party_id',${user.partyId??""},true)`);
  return context.run({tx,user},()=>fn(tx,user));
 });
}
export function currentActor(){return context.getStore()?.user.id??null;}
