"use client";
import { useActionState, useRef, useState } from "react";
import { submitAcademicOperation } from "@/lib/academicOperations";

export function DailyAnswerForm({
  questionId,
  type,
  options,
  starterCode,
  existingSelections,
  existingCode,
  alreadyAnswered,
  isCorrect,
}: {
  questionId: string;
  type: "mcq" | "program";
  options: { id: string; text: string }[];
  starterCode: string | null;
  existingSelections: string[];
  existingCode: string;
  alreadyAnswered: boolean;
  isCorrect: boolean | null;
}) {
  const request = useRef<string | null>(null);
  const [selected, setSelected] = useState<string[]>(existingSelections);
  const [code, setCode] = useState(existingCode || starterCode || "");

  const [state, action, pending] = useActionState(async (prev: { ok: boolean; message: string }, data: FormData) => {
    request.current ??= crypto.randomUUID();
    data.set("requestId", request.current);
    data.set("kind", "answerDaily");
    data.set("questionId", questionId);
    data.set("type", type);
    if (type === "mcq") data.set("selectedOptionIds", JSON.stringify(selected));
    else data.set("codeAnswer", code);
    const result = await submitAcademicOperation(prev, data);
    if (result.ok) request.current = null;
    return result;
  }, { ok: false, message: "" });

  return (
    <form action={action} className="space-y-4">
      {alreadyAnswered && isCorrect !== null && (
        <p className={`text-sm font-medium ${isCorrect ? "text-green-700" : "text-red-700"}`}>
          {isCorrect ? "Correct — already answered." : "Answered — not correct."}
        </p>
      )}
      {type === "mcq" ? (
        <div className="space-y-2">
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(o.id)}
                onChange={() => setSelected((s) => (s.includes(o.id) ? s.filter((id) => id !== o.id) : [...s, o.id]))}
              />
              {o.text}
            </label>
          ))}
        </div>
      ) : (
        <textarea
          rows={8}
          className="w-full rounded-md border border-slate-300 bg-slate-900 p-3 font-mono text-xs text-green-300"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
        />
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button className="primary w-full sm:w-auto" disabled={pending}>{pending ? "Saving..." : alreadyAnswered ? "Update answer" : "Submit answer"}</button>
        {state.message && <p role="status" className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</p>}
      </div>
    </form>
  );
}
