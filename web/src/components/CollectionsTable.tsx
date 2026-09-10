import Link from "next/link";
import { formatINR } from "@/lib/format";
import type { CollectionsAgingRow } from "@/lib/queries";

export function CollectionsTable({ rows }: { rows: CollectionsAgingRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-neutral-500">
            <th className="px-6 py-3 font-medium">Party</th>
            <th className="px-6 py-3 font-medium">Batch</th>
            <th className="px-6 py-3 font-medium">Amount due</th>
            <th className="px-6 py-3 font-medium">Due on</th>
            <th className="px-6 py-3 font-medium">Days overdue</th>
            <th className="px-6 py-3 font-medium">Rupees at risk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const overdue = row.daysOverdue > 0;
            return (
              <tr
                key={row.paymentId}
                className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
              >
                <td className="px-6 py-4 font-medium text-neutral-900">
                  {row.partyName ?? "—"}
                </td>
                <td className="px-6 py-4 text-neutral-600">
                  <Link
                    href={`/dashboard`}
                    className="hover:text-neutral-900 hover:underline"
                  >
                    {row.batchName ?? "—"}
                  </Link>
                </td>
                <td className="px-6 py-4 text-neutral-600">
                  {formatINR(row.amount)}
                </td>
                <td className="px-6 py-4 text-neutral-600">{row.dueOn}</td>
                <td className="px-6 py-4">
                  <span
                    className={
                      overdue
                        ? "font-medium text-rose-600"
                        : "text-neutral-500"
                    }
                  >
                    {row.daysOverdue}
                  </span>
                </td>
                <td className="px-6 py-4 font-semibold tabular-nums text-rose-600">
                  {formatINR(row.rupeesAtRisk)}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-10 text-center text-neutral-400">
                Nothing outstanding.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
