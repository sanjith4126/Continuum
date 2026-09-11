import Link from "next/link";
import { formatINR } from "@/lib/format";
import type { BatchPnlRow } from "@/lib/queries";

export function BatchPnlTable({ rows }: { rows: BatchPnlRow[] }) {
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(Number(r.netProfit))));

  return (
    <>
      {/* Mobile: dedicated stat cards — this is the demo's headline
          number, so it gets its own treatment rather than the generic
          table-to-card pattern used elsewhere. */}
      <div className="grid gap-3 sm:hidden">
        {rows.map((row) => {
          const profit = Number(row.netProfit);
          const isProfit = profit >= 0;
          return (
            <div
              key={row.batchId}
              className={`rounded-xl border p-4 ${
                isProfit
                  ? "border-(--color-profit-600)/25 bg-(--color-profit-100)/40"
                  : "border-(--color-loss-600)/25 bg-(--color-loss-100)/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-(--color-on-surface)">
                  {row.name}
                </span>
                {row.sourceLeadId ? (
                  <Link
                    href={`/trace/${row.sourceLeadId}`}
                    className="shrink-0 text-[12px] font-medium text-(--color-accent-500)"
                  >
                    Trace →
                  </Link>
                ) : null}
              </div>
              <div
                className={`mt-2 font-(family-name:--font-data) text-2xl font-bold tabular-nums ${
                  isProfit ? "text-(--color-profit-600)" : "text-(--color-loss-600)"
                }`}
              >
                {formatINR(row.netProfit)}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-black/5 pt-3 text-xs">
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-(--color-outline)">
                    Revenue
                  </span>
                  <span className="font-(family-name:--font-data) text-(--color-on-surface-variant)">
                    {formatINR(row.revenue)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-(--color-outline)">
                    Direct cost
                  </span>
                  <span className="font-(family-name:--font-data) text-(--color-on-surface-variant)">
                    {formatINR(row.cost)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="rounded-xl border border-(--color-outline-variant) py-10 text-center text-[13px] text-(--color-outline)">
            No batches yet.
          </div>
        )}
      </div>

      {/* Tablet/desktop: the original table with the profit/loss bar. */}
      <div className="hidden overflow-x-auto rounded-lg border border-(--color-outline-variant) bg-(--color-surface-container-lowest) sm:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="h-8 border-b border-(--color-outline-variant) bg-(--color-surface)">
              <th className="px-4 font-(family-name:--font-ui) text-[11px] font-semibold uppercase tracking-wider text-(--color-on-surface-variant)">
                Batch
              </th>
              <th className="px-4 text-right font-(family-name:--font-ui) text-[11px] font-semibold uppercase tracking-wider text-(--color-on-surface-variant)">
                Revenue
              </th>
              <th className="px-4 text-right font-(family-name:--font-ui) text-[11px] font-semibold uppercase tracking-wider text-(--color-on-surface-variant)">
                Cost
              </th>
              <th className="px-4 text-right font-(family-name:--font-ui) text-[11px] font-semibold uppercase tracking-wider text-(--color-on-surface-variant)">
                Net profit
              </th>
              <th className="px-4 font-(family-name:--font-ui) text-[11px] font-semibold uppercase tracking-wider text-(--color-on-surface-variant)"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const profit = Number(row.netProfit);
              const isProfit = profit >= 0;
              const barWidth = Math.max(4, (Math.abs(profit) / maxAbs) * 100);
              return (
                <tr
                  key={row.batchId}
                  className="h-10 border-b border-(--color-surface-container-low) last:border-0 hover:bg-(--color-surface-container-low)"
                >
                  <td className="px-4 text-[13px] font-medium text-(--color-on-surface)">
                    {row.name}
                  </td>
                  <td className="px-4 text-right font-(family-name:--font-data) text-[13px] text-(--color-on-surface-variant)">
                    {formatINR(row.revenue)}
                  </td>
                  <td className="px-4 text-right font-(family-name:--font-data) text-[13px] text-(--color-on-surface-variant)">
                    {formatINR(row.cost)}
                  </td>
                  <td className="px-4">
                    <div className="flex items-center justify-end gap-3">
                      <div className="h-1 w-16 overflow-hidden rounded-full bg-(--color-surface-container)">
                        <div
                          className={`h-full rounded-full ${
                            isProfit ? "bg-(--color-profit-600)" : "bg-(--color-loss-600)"
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span
                        className={`font-(family-name:--font-data) text-[13px] font-semibold ${
                          isProfit ? "text-(--color-profit-600)" : "text-(--color-loss-600)"
                        }`}
                      >
                        {formatINR(row.netProfit)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 text-right">
                    {row.sourceLeadId ? (
                      <Link
                        href={`/trace/${row.sourceLeadId}`}
                        className="text-[12px] text-(--color-accent-500) hover:underline"
                      >
                        Trace →
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-(--color-outline)">
                  No batches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
