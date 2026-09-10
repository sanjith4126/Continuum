import { Suspense } from "react";
import Link from "next/link";
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
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Per-batch net profit, end to end.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/collections"
              className="text-sm text-neutral-500 hover:text-neutral-900"
            >
              Collections
            </Link>
            <Link
              href="/pipeline"
              className="text-sm text-neutral-500 hover:text-neutral-900"
            >
              Run lifecycle
            </Link>
            <Suspense fallback={null}>
              <AsOfControl />
            </Suspense>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Revenue" value={formatINR(kpis.revenue)} />
          <KpiCard label="Collected" value={formatINR(kpis.collected)} />
          <KpiCard label="Outstanding" value={formatINR(kpis.outstanding)} />
          <KpiCard
            label="Net profit"
            value={formatINR(kpis.netProfit)}
            tone={netProfit >= 0 ? "positive" : "negative"}
          />
        </div>

        <div className="mt-10">
          <h2 className="mb-3 text-sm font-medium text-neutral-500">
            Net profit by batch{asOf ? ` — as of ${asOf}` : ""}
          </h2>
          <BatchPnlTable rows={batchRows} />
        </div>
      </div>
    </div>
  );
}
