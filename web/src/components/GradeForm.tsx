"use client";
import { useActionState, useRef } from "react";
import { submitAcademicOperation } from "@/lib/academicOperations";

export function GradeForm({ submissionId, maxPoints, currentGrade }: { submissionId: string; maxPoints: number; currentGrade: number | null }) {
  const request = useRef<string | null>(null);
  const [state, action, pending] = useActionState(async (prev: { ok: boolean; message: string }, data: FormData) => {
    request.current ??= crypto.randomUUID();
    data.set("requestId", request.current);
    data.set("kind", "grade");
    data.set("submissionId", submissionId);
    const result = await submitAcademicOperation(prev, data);
    if (result.ok) request.current = null;
    return result;
  }, { ok: false, message: "" });

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input name="grade" type="number" min="0" max={maxPoints} defaultValue={currentGrade ?? ""} placeholder={`/ ${maxPoints}`} className="w-20 rounded border border-slate-300 px-2 py-1 text-xs" />
      <input name="feedback" placeholder="Feedback (optional)" maxLength={2000} className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs" />
      <button className="rounded-md bg-blue-700 px-3 py-1 text-xs font-medium text-white disabled:opacity-50" disabled={pending}>
        {pending ? "Saving..." : "Grade"}
      </button>
      {state.message && <span className={`text-xs ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</span>}
    </form>
  );
}
