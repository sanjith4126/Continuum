"use client";
import { useActionState, useRef, useState } from "react";
import { submitAcademicOperation } from "@/lib/academicOperations";

type Option = { text: string; correct: boolean };
type TestCase = { input: string; expectedOutput: string };
type Question = {
  type: "mcq" | "program";
  questionText: string;
  points: number;
  language?: string;
  starterCode?: string;
  options?: Option[];
  testCases?: TestCase[];
};

// Builds an assignment plus any number of MCQ/programming questions in one
// submit -- mirrors the LMS's dedicated question-builder pages, but as one
// inline form so it fits Continuum's existing collapsible-panel workspace
// pattern rather than a separate multi-page flow.
export function AssignmentBuilderForm({ batches }: { batches: { value: string; label: string }[] }) {
  const request = useRef<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [state, action, pending] = useActionState(async (prev: { ok: boolean; message: string }, data: FormData) => {
    request.current ??= crypto.randomUUID();
    data.set("requestId", request.current);
    data.set("kind", "assignmentCreate");
    data.set("questionsJson", JSON.stringify(questions));
    const result = await submitAcademicOperation(prev, data);
    if (result.ok) {
      request.current = null;
      setQuestions([]);
    }
    return result;
  }, { ok: false, message: "" });

  function addQuestion(type: "mcq" | "program") {
    setQuestions((qs) => [
      ...qs,
      type === "mcq"
        ? { type, questionText: "", points: 10, options: [{ text: "", correct: false }, { text: "", correct: false }] }
        : { type, questionText: "", points: 10, language: "javascript", starterCode: "", testCases: [{ input: "", expectedOutput: "" }] },
    ]);
  }
  function updateQuestion(i: number, patch: Partial<Question>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function removeQuestion(i: number) {
    setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  }

  return (
    <details className="panel">
      <summary className="cursor-pointer text-sm font-semibold">Create an assignment</summary>
      <p className="mt-3 text-xs leading-6 text-slate-500">
        Plain written/file assignments work with zero questions below. Add MCQ questions (any number of options, any number correct) or
        programming questions (with example test cases shown to students as a guide) to make it an auto-graded quiz.
      </p>
      <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="field sm:col-span-2">
          Batch
          <select name="batchId" required>
            <option value="">Select...</option>
            {batches.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </label>
        <label className="field sm:col-span-2">
          Title
          <input name="title" required maxLength={200} />
        </label>
        <label className="field sm:col-span-2">
          Description
          <textarea name="description" rows={2} maxLength={4000} />
        </label>
        <label className="field">
          Due date
          <input name="dueDate" type="datetime-local" required />
        </label>
        <label className="field">
          Max points
          <input name="maxPoints" type="number" min="1" defaultValue="100" />
        </label>
        <label className="field">
          Week
          <input name="weekNumber" type="number" min="0" defaultValue="0" />
        </label>

        <div className="sm:col-span-2 space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {q.type === "mcq" ? "Multiple choice" : "Programming"} question {i + 1}
                </span>
                <button type="button" onClick={() => removeQuestion(i)} className="text-xs text-red-700">Remove</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="field sm:col-span-2">
                  Question text
                  <textarea rows={2} value={q.questionText} onChange={(e) => updateQuestion(i, { questionText: e.target.value })} />
                </label>
                <label className="field">
                  Points
                  <input type="number" min="1" value={q.points} onChange={(e) => updateQuestion(i, { points: Number(e.target.value) })} />
                </label>
                {q.type === "program" && (
                  <label className="field">
                    Language
                    <select value={q.language} onChange={(e) => updateQuestion(i, { language: e.target.value })}>
                      {["javascript", "python", "java", "cpp"].map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {q.type === "mcq" && (
                <div className="mt-3 space-y-2">
                  <span className="text-xs font-medium text-slate-600">Options (check the correct one(s))</span>
                  {q.options!.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={o.correct}
                        onChange={(e) => {
                          const opts = [...q.options!];
                          opts[oi] = { ...opts[oi], correct: e.target.checked };
                          updateQuestion(i, { options: opts });
                        }}
                      />
                      <input
                        className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                        placeholder={`Option ${oi + 1}`}
                        value={o.text}
                        onChange={(e) => {
                          const opts = [...q.options!];
                          opts[oi] = { ...opts[oi], text: e.target.value };
                          updateQuestion(i, { options: opts });
                        }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-xs text-blue-700"
                    onClick={() => updateQuestion(i, { options: [...q.options!, { text: "", correct: false }] })}
                  >
                    + Add option
                  </button>
                </div>
              )}

              {q.type === "program" && (
                <div className="mt-3 space-y-2">
                  <label className="field">
                    Starter code (optional)
                    <textarea rows={3} value={q.starterCode} onChange={(e) => updateQuestion(i, { starterCode: e.target.value })} />
                  </label>
                  <span className="text-xs font-medium text-slate-600">Example test cases</span>
                  {q.testCases!.map((t, ti) => (
                    <div key={ti} className="grid grid-cols-2 gap-2">
                      <input
                        className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                        placeholder="Input"
                        value={t.input}
                        onChange={(e) => {
                          const tc = [...q.testCases!];
                          tc[ti] = { ...tc[ti], input: e.target.value };
                          updateQuestion(i, { testCases: tc });
                        }}
                      />
                      <input
                        className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                        placeholder="Expected output"
                        value={t.expectedOutput}
                        onChange={(e) => {
                          const tc = [...q.testCases!];
                          tc[ti] = { ...tc[ti], expectedOutput: e.target.value };
                          updateQuestion(i, { testCases: tc });
                        }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-xs text-blue-700"
                    onClick={() => updateQuestion(i, { testCases: [...q.testCases!, { input: "", expectedOutput: "" }] })}
                  >
                    + Add test case
                  </button>
                </div>
              )}
            </div>
          ))}
          <div className="flex gap-3">
            <button type="button" onClick={() => addQuestion("mcq")} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium">
              + MCQ question
            </button>
            <button type="button" onClick={() => addQuestion("program")} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium">
              + Programming question
            </button>
          </div>
        </div>

        <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
          <button className="primary w-full sm:w-auto" disabled={pending}>{pending ? "Saving..." : "Create assignment"}</button>
          {state.message && <p role="status" className={`min-h-5 text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</p>}
        </div>
      </form>
    </details>
  );
}
