"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { runDemoPipeline } from "@/lib/demo";
import { formatINR } from "@/lib/format";

type Result = Awaited<ReturnType<typeof runDemoPipeline>>;

export function PipelineRunner() {
  const requestId = useRef<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        requestId.current ??= crypto.randomUUID();
        setResult(await runDemoPipeline(requestId.current));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={isPending || !!result}
        className="rounded-md bg-(--color-accent-500) px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-(--color-accent-600) disabled:opacity-50"
      >
        {isPending ? "Running…" : "Run the lifecycle"}
      </button>

      {error && (
        <div className="mt-6 rounded-lg border border-(--color-loss-600)/30 bg-(--color-loss-100) p-4 text-[13px] text-(--color-loss-600)">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-5">
          <ol className="overflow-hidden rounded-lg border border-(--color-outline-variant) bg-(--color-surface-container-lowest)">
            {result.steps.map((s, i) => (
              <li
                key={i}
                className="flex min-h-10 flex-wrap items-center gap-2 border-b border-(--color-surface-container-low) px-4 py-2 last:border-0 sm:gap-4"
              >
                <span className="w-5 shrink-0 font-(family-name:--font-data) text-[12px] text-(--color-outline)">
                  {i + 1}
                </span>
                <span className="w-48 shrink-0 text-[13px] font-medium text-(--color-on-surface)">
                  {s.step}
                </span>
                <span className="text-[13px] text-(--color-on-surface-variant)">
                  {s.detail}
                </span>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-(--color-outline-variant) bg-(--color-surface-container-lowest) p-4">
            <div>
              <div className="font-(family-name:--font-data) text-[11px] uppercase tracking-wider text-(--color-outline)">
                Net profit for the new batch
              </div>
              <div
                className={`mt-1 font-(family-name:--font-data) text-[24px] font-semibold ${
                  Number(result.netProfit) >= 0
                    ? "text-(--color-profit-600)"
                    : "text-(--color-loss-600)"
                }`}
              >
                {formatINR(result.netProfit)}
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/trace/${result.leadId}`}
                className="rounded-md border border-(--color-outline-variant) px-3 py-1.5 text-[13px] hover:bg-(--color-surface-container-low)"
              >
                View trace →
              </Link>
              <Link
                href="/dashboard"
                className="rounded-md border border-(--color-outline-variant) px-3 py-1.5 text-[13px] hover:bg-(--color-surface-container-low)"
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
