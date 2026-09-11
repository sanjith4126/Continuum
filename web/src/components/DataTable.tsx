import type { ReactNode } from "react";

export function DataTable({
  columns,
  rows,
  empty = "No records yet.",
  titleIndex = 0,
  statusIndex,
}: {
  columns: string[];
  rows: ReactNode[][];
  empty?: string;
  /** Index of the column shown as the card's bold title on mobile (default: first column). */
  titleIndex?: number;
  /** Index of the column shown as a status pill on mobile, if any (e.g. a stage/status cell). */
  statusIndex?: number;
}) {
  return (
    <>
      {/* Mobile: stacked cards, one per row — a wide table doesn't fit a
          phone, and horizontal scroll hides most of the row from a judge
          reading over your shoulder during a demo. */}
      <div className="grid gap-3 sm:hidden">
        {rows.map((row, i) => (
          <div
            key={i}
            className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
              <span className="text-sm font-semibold text-slate-900">{row[titleIndex]}</span>
              {statusIndex !== undefined && row[statusIndex] !== undefined && (
                <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                  {row[statusIndex]}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              {row.map((cell, j) =>
                j === titleIndex || j === statusIndex ? null : (
                  <div key={j} className="min-w-0">
                    <span className="block text-[10px] uppercase tracking-wide text-slate-400">
                      {columns[j]}
                    </span>
                    <span className="text-slate-700">{cell}</span>
                  </div>
                )
              )}
            </div>
          </div>
        ))}
        {!rows.length && (
          <div className="rounded-xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-500">
            {empty}
          </div>
        )}
      </div>

      {/* Tablet/desktop: the original table. */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white sm:block">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-slate-500">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
