import { requireUser } from "@/lib/auth";
import { Suspense } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { KpiCard } from "@/components/KpiCard";
import { BatchPnlTable } from "@/components/BatchPnlTable";
import { AsOfControl } from "./AsOfControl";
import {
  getBatchPnl,
  getBatchPnlAsOf,
  getDashboardKpis,
  getLeadPipeline,
} from "@/lib/queries";
import { formatINR } from "@/lib/format";
import { isDate } from "@/lib/validation";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>;
}) {
  await requireUser("dashboard");
  const { asOf: requestedDate } = await searchParams;
  const asOf = isDate(requestedDate) ? requestedDate : undefined;

  const [kpis, batchRows, pipeline] = await Promise.all([
    getDashboardKpis(),
    asOf ? getBatchPnlAsOf(asOf) : getBatchPnl(),
    getLeadPipeline(),
  ]);

  const netProfit = Number(kpis.netProfit);

  return (
    <AppShell breadcrumb="Management Overview">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
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

        {requestedDate && !asOf && <p role="alert" className="mt-4 text-sm text-(--color-loss-600)">Invalid date. Showing current results.</p>}
        {asOf && <p className="mt-4 text-sm text-(--color-outline)">KPI cards show current totals. The batch table shows the selected date through end of day (India time).</p>}

        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold text-(--color-on-surface)">
              Pipeline
            </h2>
            <Link
              href="/crm"
              className="text-[12px] text-(--color-accent-500) hover:underline"
            >
              Open CRM →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Total leads" value={String(pipeline.totalLeads)} />
            <KpiCard label="Won" value={String(pipeline.won)} tone="positive" />
            <KpiCard label="Open" value={String(pipeline.open)} />
            <KpiCard
              label="Conversion rate"
              value={
                pipeline.won + pipeline.lost === 0
                  ? "—"
                  : `${Math.round(pipeline.conversionRate * 100)}%`
              }
            />
          </div>
        </div>

        <div className="mt-8">
          <h2 className="mb-2 text-[14px] font-semibold text-(--color-on-surface)">
            Financials
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Revenue" value={formatINR(kpis.revenue)} />
            <KpiCard label="Collected" value={formatINR(kpis.collected)} />
            <KpiCard label="Outstanding" value={formatINR(kpis.outstanding)} />
            <KpiCard
              label="Net profit"
              value={formatINR(kpis.netProfit)}
              tone={netProfit >= 0 ? "positive" : "negative"}
            />
          </div>
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
