import Link from "next/link";
import { formatINR } from "@/lib/format";
import type { CollectionsAgingRow } from "@/lib/queries";

export function CollectionsTable({ rows }: { rows: CollectionsAgingRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-(--color-outline-variant) bg-(--color-surface-container-lowest)">
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
  );
}
