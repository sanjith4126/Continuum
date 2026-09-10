"use client";

import { useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";

type ConsultantResponse =
  | {
      ok: true;
      answer: string;
      sql: string;
      rows: Record<string, unknown>[];
      source: "cache" | "live";
    }
  | { ok: false; message: string };

const EXAMPLE_QUESTIONS = [
  "Which batches lost money this quarter?",
  "What's our total net profit?",
  "What's outstanding in collections right now?",
];

export function ConsultantChat() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConsultantResponse | null>(null);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/consultant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data: ConsultantResponse = await res.json();
      setResult(data);
    } catch {
      setResult({ ok: false, message: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  function exportToExcel() {
    if (!result || !result.ok || result.rows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(result.rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Answer");
    XLSX.writeFile(wb, "continuum-consultant-answer.xlsx");
  }

  const firstBatchId =
    result && result.ok
      ? (result.rows.find((r) => typeof r.batch_id === "string")?.batch_id as
          | string
          | undefined)
      : undefined;

  return (
    <div>
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
          placeholder="Ask about batch profit, collections, or totals…"
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
            <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <p className="text-lg text-neutral-900">{result.answer}</p>
                <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-500">
                  {result.source === "cache" ? "cached" : "live"}
                </span>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
                  SQL
                </div>
                <pre className="overflow-x-auto rounded-xl bg-neutral-900 p-4 text-xs text-neutral-100">
                  <code>{result.sql}</code>
                </pre>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {firstBatchId && (
                  <Link
                    href="/dashboard"
                    className="rounded-full border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50"
                  >
                    View trace →
                  </Link>
                )}
                <button
                  onClick={exportToExcel}
                  disabled={result.rows.length === 0}
                  className="rounded-full border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-40"
                >
                  Export to Excel
                </button>
                <span className="text-xs text-neutral-400">
                  {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
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
