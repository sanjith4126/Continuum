import Link from "next/link";
import { formatINR } from "@/lib/format";
import type { BatchPnlRow } from "@/lib/queries";
import { StatusChip } from "./StatusChip";

export function BatchPnlTable({ rows }: { rows: BatchPnlRow[] }) {
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(Number(r.netProfit))));

  return (
    <div className="overflow-hidden rounded-lg border border-(--color-outline-variant) bg-(--color-surface-container-lowest)">
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
  );
}
