import Link from "next/link";
import { formatINR } from "@/lib/format";
import type { BatchPnlRow } from "@/lib/queries";

export function BatchPnlTable({ rows }: { rows: BatchPnlRow[] }) {
  const maxAbs = Math.max(
    1,
    ...rows.map((r) => Math.abs(Number(r.netProfit)))
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-neutral-500">
            <th className="px-6 py-3 font-medium">Batch</th>
            <th className="px-6 py-3 font-medium">Revenue</th>
            <th className="px-6 py-3 font-medium">Cost</th>
            <th className="px-6 py-3 font-medium">Net profit</th>
            <th className="px-6 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const profit = Number(row.netProfit);
            const isProfit = profit >= 0;
            const barWidth = Math.max(
              4,
              (Math.abs(profit) / maxAbs) * 100
            );
            return (
              <tr
                key={row.batchId}
                className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
              >
                <td className="px-6 py-4 font-medium text-neutral-900">
                  {row.name}
                </td>
                <td className="px-6 py-4 text-neutral-600">
                  {formatINR(row.revenue)}
                </td>
                <td className="px-6 py-4 text-neutral-600">
                  {formatINR(row.cost)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-semibold tabular-nums ${
                        isProfit ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {formatINR(row.netProfit)}
                    </span>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className={`h-full rounded-full ${
                          isProfit ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  {row.sourceLeadId ? (
                    <Link
                      href={`/trace/${row.sourceLeadId}`}
                      className="text-sm text-neutral-400 hover:text-neutral-900"
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
              <td colSpan={5} className="px-6 py-10 text-center text-neutral-400">
                No batches yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
