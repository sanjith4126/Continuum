"use client";
import { useActionState, useState, useRef } from "react";
import { submitOperation } from "@/lib/operations";

type Lead = { id: string; name: string; email: string | null; phone: string | null; source: string | null };

export function EditLeadForm({ leads }: { leads: Lead[] }) {
  const [selectedId, setSelectedId] = useState(leads[0]?.id ?? "");
  const selected = leads.find((l) => l.id === selectedId) ?? null;
  const request = useRef<string | null>(null);
  const [state, action, pending] = useActionState(async (prev: { ok: boolean; message: string }, data: FormData) => {
    request.current ??= crypto.randomUUID();
    data.set("requestId", request.current);
    data.set("kind", "leadEdit");
    const result = await submitOperation(prev, data);
    if (result.ok) request.current = null;
    return result;
  }, { ok: false, message: "" });

  if (!leads.length) {
    return <details className="panel"><summary className="cursor-pointer text-sm font-semibold">Edit an existing lead</summary><p className="mt-3 text-xs text-slate-500">No leads yet.</p></details>;
  }

  return (
    <details className="panel">
      <summary className="cursor-pointer text-sm font-semibold">Edit an existing lead</summary>
      <p className="mt-3 text-xs leading-6 text-slate-500">Pick a lead below — its current details fill in automatically. Change what&apos;s wrong and save.</p>
      <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="field sm:col-span-2">
          Lead
          <select
            name="enquiryId"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            required
          >
            {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="field">
          Customer name
          <input key={`name-${selectedId}`} name="name" defaultValue={selected?.name ?? ""} required maxLength={200} />
        </label>
        <label className="field">
          Email
          <input key={`email-${selectedId}`} name="email" type="email" defaultValue={selected?.email ?? ""} maxLength={254} />
        </label>
        <label className="field">
          Phone
          <input key={`phone-${selectedId}`} name="phone" defaultValue={selected?.phone ?? ""} maxLength={200} />
        </label>
        <label className="field">
          Source
          <input key={`source-${selectedId}`} name="source" defaultValue={selected?.source ?? ""} maxLength={200} />
        </label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
          <button className="primary" disabled={pending}>{pending ? "Saving..." : "Save changes"}</button>
          {state.message && <p role="status" className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</p>}
        </div>
      </form>
    </details>
  );
}
