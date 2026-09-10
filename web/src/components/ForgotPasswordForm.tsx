"use client";
import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/auth-actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, { error: "", sent: false });
  if (state.sent) {
    return (
      <div role="status" className="panel text-sm leading-6 text-green-700">
        {state.message ?? "If that email is registered, a new temporary password has been sent to it."}
      </div>
    );
  }
  return (
    <form action={action} className="space-y-5">
      <label className="field">
        Email address
        <input name="email" type="email" autoComplete="username" required maxLength={254} />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button className="primary w-full" disabled={pending}>{pending ? "Sending…" : "Send new password"}</button>
    </form>
  );
}
