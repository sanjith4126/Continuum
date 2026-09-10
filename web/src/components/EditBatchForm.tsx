"use client";
import { useActionState, useState, useRef } from "react";
import { submitOperation } from "@/lib/operations";

type Batch = { id: string; name: string; location: string | null; starts_on: string | null; ends_on: string | null };

export function EditBatchForm({ batches }: { batches: Batch[] }) {
  const [selectedId, setSelectedId] = useState(batches[0]?.id ?? "");
  const selected = batches.find((b) => b.id === selectedId) ?? null;
  const request = useRef<string | null>(null);
  const [state, action, pending] = useActionState(async (prev: { ok: boolean; message: string }, data: FormData) => {
    request.current ??= crypto.randomUUID();
    data.set("requestId", request.current);
    data.set("kind", "batchEdit");
    const result = await submitOperation(prev, data);
    if (result.ok) request.current = null;
    return result;
  }, { ok: false, message: "" });

  if (!batches.length) {
    return <details className="panel"><summary className="cursor-pointer text-sm font-semibold">Edit a batch</summary><p className="mt-3 text-xs text-slate-500">No batches yet.</p></details>;
  }

  return (
    <details className="panel">
      <summary className="cursor-pointer text-sm font-semibold">Edit a batch</summary>
      <p className="mt-3 text-xs leading-6 text-slate-500">Pick a batch — its current name, location and dates fill in automatically. Correct what&apos;s wrong and save.</p>
      <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="field sm:col-span-2">
          Batch
          <select name="batchId" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} required>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="field sm:col-span-2">
          Batch name
          <input key={`name-${selectedId}`} name="name" defaultValue={selected?.name ?? ""} required maxLength={200} />
        </label>
        <label className="field">
          Location
          <input key={`location-${selectedId}`} name="location" defaultValue={selected?.location ?? ""} maxLength={200} />
        </label>
        <div />
        <label className="field">
          Start date
          <input key={`starts-${selectedId}`} name="startsOn" type="date" defaultValue={selected?.starts_on ?? ""} />
        </label>
        <label className="field">
          End date
          <input key={`ends-${selectedId}`} name="endsOn" type="date" defaultValue={selected?.ends_on ?? ""} />
        </label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
          <button className="primary" disabled={pending}>{pending ? "Saving..." : "Save changes"}</button>
          {state.message && <p role="status" className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</p>}
        </div>
      </form>
    </details>
  );
}
