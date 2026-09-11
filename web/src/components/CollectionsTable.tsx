import Link from "next/link";
import { formatINR } from "@/lib/format";
import type { CollectionsAgingRow } from "@/lib/queries";

export function CollectionsTable({ rows }: { rows: CollectionsAgingRow[] }) {
  return (
    <>
      {/* Mobile: aging cards, ranked by risk — the overdue badge is the
          thing a judge needs to see first, so it's the card's top-right
          anchor rather than a table cell six columns in. */}
      <div className="grid gap-3 sm:hidden">
        {rows.map((row) => {
          const overdue = row.daysOverdue > 0;
          return (
            <div
              key={row.paymentId}
              className="space-y-2 rounded-xl border border-(--color-outline-variant) bg-(--color-surface-container-lowest) p-4"
            >
              <div className="flex items-start justify-between gap-2 border-b border-black/5 pb-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-(--color-on-surface)">
                    {row.partyName ?? "—"}
                  </div>
                  <Link
                    href="/dashboard"
                    className="text-[12px] text-(--color-accent-500)"
                  >
                    {row.batchName ?? "—"}
                  </Link>
                </div>
                {overdue && (
                  <span className="shrink-0 rounded-full bg-(--color-loss-100) px-2.5 py-0.5 text-[11px] font-semibold text-(--color-loss-600)">
                    {row.daysOverdue}d overdue
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-(--color-outline)">
                    Amount due
                  </span>
                  <span className="font-(family-name:--font-data) text-(--color-on-surface-variant)">
                    {formatINR(row.amount)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-(--color-outline)">
                    Due on
                  </span>
                  <span className="font-(family-name:--font-data) text-(--color-on-surface-variant)">
                    {row.dueOn}
                  </span>
                </div>
              </div>
              <div className="border-t border-black/5 pt-2">
                <span className="block text-[10px] uppercase tracking-wide text-(--color-outline)">
                  Rupees at risk
                </span>
                <span className="font-(family-name:--font-data) text-lg font-bold text-(--color-loss-600)">
                  {formatINR(row.rupeesAtRisk)}
                </span>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="rounded-xl border border-(--color-outline-variant) py-10 text-center text-[13px] text-(--color-outline)">
            Nothing outstanding.
          </div>
        )}
      </div>

      {/* Tablet/desktop: the original table. */}
      <div className="hidden overflow-x-auto rounded-lg border border-(--color-outline-variant) bg-(--color-surface-container-lowest) sm:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="h-8 border-b border-(--color-outline-variant) bg-(--color-surface)">
              <th className="px-4 font-(family-name:--font-ui) text-[11px] font-semibold uppercase tracking-wider text-(--color-on-surface-variant)">
                Party
              </th>
              <th className="px-4 font-(family-name:--font-ui) text-[11px] font-semibold uppercase tracking-wider text-(--color-on-surface-variant)">
                Batch
              </th>
              <th className="px-4 text-right font-(family-name:--font-ui) text-[11px] font-semibold uppercase tracking-wider text-(--color-on-surface-variant)">
                Amount due
              </th>
              <th className="px-4 font-(family-name:--font-ui) text-[11px] font-semibold uppercase tracking-wider text-(--color-on-surface-variant)">
                Due on
              </th>
              <th className="px-4 text-right font-(family-name:--font-ui) text-[11px] font-semibold uppercase tracking-wider text-(--color-on-surface-variant)">
                Days overdue
              </th>
              <th className="px-4 text-right font-(family-name:--font-ui) text-[11px] font-semibold uppercase tracking-wider text-(--color-on-surface-variant)">
                Rupees at risk
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const overdue = row.daysOverdue > 0;
              return (
                <tr
                  key={row.paymentId}
                  className="h-10 border-b border-(--color-surface-container-low) last:border-0 hover:bg-(--color-surface-container-low)"
                >
                  <td className="px-4 text-[13px] font-medium text-(--color-on-surface)">
                    {row.partyName ?? "—"}
                  </td>
                  <td className="px-4 text-[13px] text-(--color-on-surface-variant)">
                    <Link
                      href="/dashboard"
                      className="hover:text-(--color-accent-500) hover:underline"
                    >
                      {row.batchName ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 text-right font-(family-name:--font-data) text-[13px] text-(--color-on-surface-variant)">
                    {formatINR(row.amount)}
                  </td>
                  <td className="px-4 font-(family-name:--font-data) text-[13px] text-(--color-on-surface-variant)">
                    {row.dueOn}
                  </td>
                  <td className="px-4 text-right">
                    <span
                      className={
                        "font-(family-name:--font-data) text-[13px] " +
                        (overdue
                          ? "font-medium text-(--color-loss-600)"
                          : "text-(--color-on-surface-variant)")
                      }
                    >
                      {row.daysOverdue}
                    </span>
                  </td>
                  <td className="px-4 text-right font-(family-name:--font-data) text-[13px] font-semibold text-(--color-loss-600)">
                    {formatINR(row.rupeesAtRisk)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-(--color-outline)">
                  Nothing outstanding.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
