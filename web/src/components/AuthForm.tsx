"use client";
import { useActionState } from "react";
import { login,changePassword } from "@/lib/auth-actions";
export function AuthForm({change=false}:{change?:boolean}) {
 const [state,action,pending]=useActionState(change?changePassword:login,{error:""});
 return <form action={action} className="space-y-5">
  {change ? <>
   <label className="field">Current password<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128}/></label>
   <label className="field">New password<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
   <label className="field">Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
  </> : <>
   <label className="field">Email address<input name="email" type="email" autoComplete="username" required maxLength={254}/></label>
   <label className="field">Password<input name="password" type="password" autoComplete="current-password" required maxLength={128}/></label>
  </>}
  {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
  <button className="primary w-full" disabled={pending}>{pending?"Please wait…":change?"Update password":"Sign in"}</button>
 </form>;
}
