import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { KpiCard } from "@/components/KpiCard";
import { BatchPnlTable } from "@/components/BatchPnlTable";
import { AsOfControl } from "./AsOfControl";
import { getBatchPnl, getBatchPnlAsOf, getDashboardKpis } from "@/lib/queries";
import { formatINR } from "@/lib/format";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>;
}) {
  const { asOf } = await searchParams;

  const [kpis, batchRows] = await Promise.all([
    getDashboardKpis(),
    asOf ? getBatchPnlAsOf(asOf) : getBatchPnl(),
  ]);

  const netProfit = Number(kpis.netProfit);

  return (
    <AppShell breadcrumb="Management Overview">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-(--color-on-surface)">
              Management Overview
            </h1>
            <p className="mt-1 text-[13px] text-(--color-outline)">
              Per-batch net profit, end to end.
            </p>
          </div>
          <Suspense fallback={null}>
            <AsOfControl />
          </Suspense>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Revenue" value={formatINR(kpis.revenue)} />
          <KpiCard label="Collected" value={formatINR(kpis.collected)} />
          <KpiCard label="Outstanding" value={formatINR(kpis.outstanding)} />
          <KpiCard
            label="Net profit"
            value={formatINR(kpis.netProfit)}
            tone={netProfit >= 0 ? "positive" : "negative"}
          />
        </div>

        <div className="mt-8">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold text-(--color-on-surface)">
              Net profit by batch
            </h2>
            {asOf && (
              <span className="font-(family-name:--font-data) text-[11px] text-(--color-outline)">
                as of {asOf}
              </span>
            )}
          </div>
          <BatchPnlTable rows={batchRows} />
        </div>
      </div>
    </AppShell>
  );
}
