"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { runDemoPipeline } from "@/lib/demo";
import { formatINR } from "@/lib/format";

type Result = Awaited<ReturnType<typeof runDemoPipeline>>;

export function PipelineRunner() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        setResult(await runDemoPipeline());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={isPending}
        className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50"
      >
        {isPending ? "Running…" : "Run the lifecycle"}
      </button>

      {error && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          <ol className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            {result.steps.map((s, i) => (
              <li
                key={i}
                className="flex items-baseline gap-4 border-b border-neutral-100 px-6 py-3 text-sm last:border-0"
              >
                <span className="w-6 shrink-0 text-neutral-300 tabular-nums">
                  {i + 1}
                </span>
                <span className="w-52 shrink-0 font-medium text-neutral-900">
                  {s.step}
                </span>
                <span className="text-neutral-500">{s.detail}</span>
              </li>
            ))}
          </ol>

          <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div>
              <div className="text-sm font-medium text-neutral-500">
                Net profit for the new batch
              </div>
              <div
                className={`mt-1 text-3xl font-semibold ${
                  Number(result.netProfit) >= 0
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {formatINR(result.netProfit)}
              </div>
            </div>
            <div className="flex gap-3 text-sm">
              <Link
                href={`/trace/${result.leadId}`}
                className="rounded-full border border-neutral-200 px-4 py-2 hover:bg-neutral-50"
              >
                View trace →
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full border border-neutral-200 px-4 py-2 hover:bg-neutral-50"
              >
                Dashboard →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
