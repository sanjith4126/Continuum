"use client";

import { useState } from "react";

type AssistantResponse =
  | { ok: true; answer: string; tool: "schedule" | "balance" }
  | { ok: false; message: string };

type Turn =
  | { role: "student"; text: string }
  | { role: "assistant"; response: AssistantResponse };

const EXAMPLE_QUESTIONS = ["When's my next class?", "What's my balance?"];

export function AssistantChat({
  students,
}: {
  students: { id: string; name: string }[];
}) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);

  const currentStudent = students.find((s) => s.id === studentId);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading || !studentId) return;
    setLoading(true);
    setTurns((t) => [...t, { role: "student", text: trimmed }]);
    setQuestion("");
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, question: trimmed }),
      });
      const data: AssistantResponse = await res.json();
      setTurns((t) => [...t, { role: "assistant", response: data }]);
    } catch {
      setTurns((t) => [
        ...t,
        { role: "assistant", response: { ok: false, message: "Network error. Please try again." } },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Honest demo-mode identity notice — this project has no real auth.
          The picker below is genuinely client-supplied input; what makes
          answers safe is that the server independently validates studentId
          against real student rows and RLS then scopes every query to
          whichever party_id is accepted, regardless of the picker's label. */}
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-(--color-outline-variant) bg-(--color-surface-container-low) p-3">
        <span className="mt-0.5 text-[14px] text-(--color-accent-500)">●</span>
        <p className="font-(family-name:--font-data) text-[11px] leading-relaxed text-(--color-on-surface-variant)">
          <strong className="text-(--color-on-surface)">Demo mode:</strong> this
          project has no real login yet, so pick who&apos;s signed in below.
          Every answer is then scoped by row-level security to that
          student&apos;s own rows — the picker only chooses identity, not
          what a student can see once picked.
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-lg border border-(--color-outline-variant) bg-(--color-surface-container-lowest) p-3">
        <div className="flex flex-col">
          <span className="font-(family-name:--font-data) text-[10px] uppercase tracking-wider text-(--color-outline)">
            Signed in as
          </span>
          <span className="text-[14px] font-semibold text-(--color-on-surface)">
            {currentStudent?.name ?? "—"}
          </span>
        </div>
        <select
          value={studentId}
          onChange={(e) => {
            setStudentId(e.target.value);
            setTurns([]);
          }}
          className="h-8 rounded-md border border-(--color-outline-variant) bg-(--color-surface) px-2 text-[13px] text-(--color-on-surface) outline-none"
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3">
        {turns.map((turn, i) =>
          turn.role === "student" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-lg rounded-tr-none bg-(--color-accent-500) px-3 py-2 text-[13px] text-white">
                {turn.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              {turn.response.ok ? (
                <div className="max-w-[85%] rounded-lg rounded-tl-none border border-(--color-outline-variant) bg-(--color-surface-container-lowest) px-3 py-2.5">
                  <div className="mb-1 font-(family-name:--font-data) text-[10px] uppercase tracking-wider text-(--color-outline)">
                    {turn.response.tool}
                  </div>
                  <p className="text-[13px] leading-snug text-(--color-on-surface)">
                    {turn.response.answer}
                  </p>
                </div>
              ) : (
                <div className="max-w-[85%] rounded-lg rounded-tl-none border border-(--color-warn-600)/30 bg-(--color-warn-100) px-3 py-2.5 text-[13px] text-(--color-warn-600)">
                  {turn.response.message}
                </div>
              )}
            </div>
          )
        )}
      </div>

      <div className="sticky bottom-4 mt-4 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              disabled={loading}
              className="rounded-full bg-(--color-surface-container) px-3 py-1 font-(family-name:--font-data) text-[11px] text-(--color-on-surface-variant) hover:bg-(--color-surface-container-high) disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex items-center gap-2 rounded-lg border border-(--color-outline-variant) bg-(--color-surface-container-lowest) p-1.5"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about your schedule or balance…"
            className="h-8 flex-1 bg-transparent px-2 text-[13px] text-(--color-on-surface) outline-none placeholder:text-(--color-outline)"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-(--color-accent-500) text-white transition-colors hover:bg-(--color-accent-600) disabled:opacity-50"
            aria-label="Send"
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}
