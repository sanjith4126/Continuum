"use client";
import { useActionState, useRef, useState } from "react";
import { submitAcademicOperation } from "@/lib/academicOperations";

type Option = { id: string; option_text: string };
type Question = {
  id: string;
  type: "mcq" | "program";
  question_text: string;
  points: number;
  language: string | null;
  starter_code: string | null;
  options: Option[];
  testCases: { input: string; expected_output: string }[];
};

export function AssignmentTaker({
  assignmentId,
  questions,
  existingContent,
  alreadySubmitted,
}: {
  assignmentId: string;
  questions: Question[];
  existingContent: string;
  alreadySubmitted: boolean;
}) {
  const request = useRef<string | null>(null);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [codeAnswers, setCodeAnswers] = useState<Record<string, string>>({});
  const [content, setContent] = useState(existingContent);

  const [state, action, pending] = useActionState(async (prev: { ok: boolean; message: string }, data: FormData) => {
    request.current ??= crypto.randomUUID();
    data.set("requestId", request.current);
    data.set("kind", "submitAssignment");
    data.set("assignmentId", assignmentId);
    data.set("content", content);
    const answers = questions.map((q) => ({
      questionId: q.id,
      type: q.type,
      selectedOptionIds: selections[q.id] ?? [],
      codeAnswer: codeAnswers[q.id] ?? "",
    }));
    data.set("answersJson", JSON.stringify(answers));
    const result = await submitAcademicOperation(prev, data);
    if (result.ok) request.current = null;
    return result;
  }, { ok: false, message: "" });

  function toggleOption(questionId: string, optionId: string, multiSelect: boolean) {
    setSelections((s) => {
      const current = s[questionId] ?? [];
      if (multiSelect) {
        return { ...s, [questionId]: current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId] };
      }
      return { ...s, [questionId]: current.includes(optionId) ? [] : [optionId] };
    });
  }

  return (
    <form action={action} className="space-y-6">
      {questions.length === 0 && (
        <label className="field">
          Your response
          <textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your answer, or paste a link to your work." />
        </label>
      )}

      {questions.map((q, i) => (
        <div key={q.id} className="panel">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Question {i + 1} · {q.type === "mcq" ? "Multiple choice" : "Programming"} · {q.points} pts
            </span>
          </div>
          <p className="mb-4 text-sm text-slate-800">{q.question_text}</p>

          {q.type === "mcq" && (
            <div className="space-y-2">
              {q.options.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={(selections[q.id] ?? []).includes(o.id)}
                    onChange={() => toggleOption(q.id, o.id, true)}
                  />
                  {o.option_text}
                </label>
              ))}
            </div>
          )}

          {q.type === "program" && (
            <div className="space-y-2">
              {q.testCases.length > 0 && (
                <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                  {q.testCases.map((t, ti) => (
                    <div key={ti}>Input: <code>{t.input}</code> → Expected: <code>{t.expected_output}</code></div>
                  ))}
                </div>
              )}
              <textarea
                rows={8}
                className="w-full rounded-md border border-slate-300 bg-slate-900 p-3 font-mono text-xs text-green-300"
                value={codeAnswers[q.id] ?? q.starter_code ?? ""}
                onChange={(e) => setCodeAnswers((c) => ({ ...c, [q.id]: e.target.value }))}
                spellCheck={false}
              />
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-4">
        <button className="primary w-full sm:w-auto" disabled={pending}>
          {pending ? "Submitting..." : alreadySubmitted ? "Resubmit answers" : "Submit answers"}
        </button>
        {state.message && <p role="status" className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</p>}
      </div>
    </form>
  );
}
