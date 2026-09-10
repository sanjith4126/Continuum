"use client";

import { useState } from "react";

type AssistantResponse =
  | { ok: true; answer: string; tool: "schedule" | "balance" }
  | { ok: false; message: string };

const EXAMPLE_QUESTIONS = ["When's my next class?", "What's my balance?"];

export function AssistantChat({
  students,
}: {
  students: { id: string; name: string }[];
}) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssistantResponse | null>(null);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading || !studentId) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, question: trimmed }),
      });
      const data: AssistantResponse = await res.json();
      setResult(data);
    } catch {
      setResult({ ok: false, message: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
        Demo mode: this project has no real login yet, so pick who&apos;s
        &quot;signed in&quot; below. Once picked, every answer is scoped by
        row-level security to that student&apos;s own rows — the picker
        controls identity, not what a student can see once picked.
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-neutral-500">Signed in as</label>
        <select
          value={studentId}
          onChange={(e) => {
            setStudentId(e.target.value);
            setResult(null);
          }}
          className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-900 outline-none"
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex gap-3"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="When's my next class? What's my balance?"
          className="flex-1 rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm text-neutral-900 shadow-sm outline-none focus:border-neutral-400"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50"
        >
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => {
              setQuestion(q);
              ask(q);
            }}
            disabled={loading}
            className="rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs text-neutral-500 hover:border-neutral-400 hover:text-neutral-900 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {result && (
        <div className="mt-8">
          {result.ok ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <p className="text-lg text-neutral-900">{result.answer}</p>
                <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-500">
                  {result.tool}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
              {result.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
