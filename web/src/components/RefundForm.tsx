"use client";
import { useActionState, useRef } from "react";
import { submitOperation } from "@/lib/operations";
import { formatINR } from "@/lib/format";

type PaidInstallment = { id: string; batch: string; amount: string; refunded: string };

export function RefundForm({ payments }: { payments: PaidInstallment[] }) {
  const request = useRef<string | null>(null);
  const [state, action, pending] = useActionState(async (prev: { ok: boolean; message: string }, data: FormData) => {
    request.current ??= crypto.randomUUID();
    data.set("requestId", request.current);
    data.set("kind", "refund");
    const result = await submitOperation(prev, data);
    if (result.ok) request.current = null;
    return result;
  }, { ok: false, message: "" });

  const refundable = payments.filter((p) => Number(p.amount) - Number(p.refunded) > 0.01);

  return (
    <details className="panel">
      <summary className="cursor-pointer text-sm font-semibold">Refund a payment</summary>
      <p className="mt-3 text-xs leading-6 text-slate-500">Records a refund against a received installment. Cannot exceed what was actually collected — the server checks this even if the amount typed here doesn&apos;t.</p>
      <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="field sm:col-span-2">
          Received installment
          <select name="paymentId" required disabled={!refundable.length}>
            {!refundable.length && <option value="">No refundable payments</option>}
            {refundable.map((p) => {
              const outstanding = (Number(p.amount) - Number(p.refunded)).toFixed(2);
              return (
                <option key={p.id} value={p.id}>
                  {p.batch} / {formatINR(p.amount)} received{Number(p.refunded) > 0 ? `, ${formatINR(p.refunded)} already refunded` : ""} / up to {formatINR(outstanding)} refundable
                </option>
              );
            })}
          </select>
        </label>
        <label className="field">
          Refund amount (INR)
          <input name="amount" type="number" min="0.01" step="0.01" required disabled={!refundable.length} />
        </label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
          <button className="primary w-full sm:w-auto" disabled={pending || !refundable.length}>{pending ? "Saving..." : "Record refund"}</button>
          {state.message && <p role="status" className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</p>}
        </div>
      </form>
    </details>
  );
}
