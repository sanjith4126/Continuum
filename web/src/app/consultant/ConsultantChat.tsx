"use client";

import { useState } from "react";
import Link from "next/link";

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
  "Which batches are currently losing money?",
  "What's our total net profit?",
  "What's outstanding in collections right now?",
];

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return String(value);
}

export function ConsultantChat() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConsultantResponse | null>(null);
  const [sqlExpanded, setSqlExpanded] = useState(true);

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

  async function exportToExcel() {
    if (!result || !result.ok || result.rows.length === 0) return;
    const XLSX = await import("xlsx");
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

  const columns = result && result.ok && result.rows.length > 0 ? Object.keys(result.rows[0]) : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Natural query pipeline */}
      <div className="rounded-lg border border-(--color-outline-variant) bg-(--color-surface-container-lowest) p-4">
        <div className="flex items-center justify-between pb-3">
          <span className="font-(family-name:--font-data) text-[11px] uppercase tracking-wider text-(--color-on-surface-variant)">
            Natural query
          </span>
          <span className="font-(family-name:--font-data) text-[11px] text-(--color-outline)">
            Read-only · 3 whitelisted views
          </span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex items-center gap-2 rounded-md border border-(--color-outline-variant) bg-(--color-surface) px-2 py-1"
        >
          <span className="font-(family-name:--font-data) text-[13px] font-semibold text-(--color-accent-500)">
            &gt;
          </span>
          <input
            aria-label="Business question"
            maxLength={500}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about batch profit, collections, or totals…"
            className="h-8 min-w-0 flex-1 bg-transparent font-(family-name:--font-data) text-[13px] text-(--color-on-surface) outline-none placeholder:text-(--color-outline)"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="h-8 shrink-0 rounded-md bg-(--color-accent-500) px-3 text-[13px] font-medium text-white transition-colors hover:bg-(--color-accent-600) disabled:opacity-50"
          >
            {loading ? "Thinking…" : "Execute"}
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => {
                setQuestion(q);
                ask(q);
              }}
              disabled={loading}
              className="rounded bg-(--color-surface-container) px-2 py-1 font-(family-name:--font-data) text-[11px] text-(--color-on-surface-variant) transition-colors hover:bg-(--color-surface-container-high) disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {result && (
        <>
          {result.ok ? (
            <>
              {/* Synthesis summary */}
              <div className="rounded-lg border border-(--color-outline-variant) bg-(--color-surface-container-lowest) p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-(family-name:--font-data) text-[11px] uppercase tracking-wider text-(--color-outline)">
                    Answer
                  </span>
                  <span className="rounded bg-(--color-surface-container) px-1.5 py-0.5 font-(family-name:--font-data) text-[10px] font-medium uppercase text-(--color-on-surface-variant)">
                    {result.source === "cache" ? "cached" : "live"}
                  </span>
                </div>
                <p className="text-[15px] font-medium leading-snug text-(--color-on-surface)">
                  {result.answer}
                </p>
              </div>

              {/* Tabular output */}
              {result.rows.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-(--color-outline-variant) bg-(--color-surface-container-lowest)">
                  <div className="flex items-center justify-between border-b border-(--color-outline-variant) px-4 py-2">
                    <span className="text-[13px] font-semibold text-(--color-on-surface)">
                      Result
                    </span>
                    <span className="font-(family-name:--font-data) text-[11px] text-(--color-outline)">
                      {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="h-8 bg-(--color-surface)">
                          {columns.map((col) => (
                            <th
                              key={col}
                              className="px-4 font-(family-name:--font-ui) text-[11px] font-semibold uppercase tracking-wider text-(--color-on-surface-variant)"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, i) => (
                          <tr
                            key={i}
                            className="h-10 border-t border-(--color-surface-container-low)"
                          >
                            {columns.map((col) => (
                              <td
                                key={col}
                                className="px-4 font-(family-name:--font-data) text-[13px] text-(--color-on-surface)"
                              >
                                {formatCellValue(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SQL block */}
              <div className="overflow-hidden rounded-lg border border-(--color-outline-variant) bg-(--color-surface-container-lowest)">
                <button
                  onClick={() => setSqlExpanded((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-(--color-surface-container-low)"
                >
                  <span className="text-[13px] font-semibold text-(--color-on-surface)">
                    SQL executed
                  </span>
                  <span className="text-[11px] text-(--color-outline)">
                    {sqlExpanded ? "Collapse" : "Expand"}
                  </span>
                </button>
                {sqlExpanded && (
                  <div className="px-4 pb-4">
                    <pre className="overflow-x-auto rounded-md bg-[#1a1c20] p-3 font-(family-name:--font-data) text-[12px] leading-relaxed text-[#e2e2e8]">
                      <code>{result.sql}</code>
                    </pre>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {firstBatchId && (
                  <Link
                    href="/dashboard"
                    className="rounded-md border border-(--color-outline-variant) px-3 py-1.5 text-[13px] text-(--color-on-surface) hover:bg-(--color-surface-container-low)"
                  >
                    View batches →
                  </Link>
                )}
                <button
                  onClick={exportToExcel}
                  disabled={result.rows.length === 0}
                  className="rounded-md border border-(--color-outline-variant) px-3 py-1.5 text-[13px] text-(--color-on-surface) hover:bg-(--color-surface-container-low) disabled:opacity-40"
                >
                  Export to Excel (.xlsx)
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-(--color-warn-600)/30 bg-(--color-warn-100) p-4 text-[13px] text-(--color-warn-600)">
              {result.message}
            </div>
          )}
        </>
      )}
    </div>
  );
}
