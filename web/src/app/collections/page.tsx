import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { CollectionsTable } from "@/components/CollectionsTable";
import { getCollectionsAging } from "@/lib/queries";
import { formatINR } from "@/lib/format";

export default async function CollectionsPage() {
  await requireUser("finance");
  const rows = await getCollectionsAging();
  const totalAtRisk = rows.reduce((sum, r) => sum + Number(r.rupeesAtRisk), 0);

  return (
    <AppShell breadcrumb="Collections">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-(--color-on-surface)">
              Collections
            </h1>
            <p className="mt-1 text-[13px] text-(--color-outline)">
              Outstanding installments ranked by rupees at risk.
            </p>
          </div>
          <div className="rounded-lg border border-(--color-loss-600)/30 bg-(--color-loss-100) px-4 py-2 text-right">
            <div className="font-(family-name:--font-data) text-[10px] uppercase tracking-wider text-(--color-loss-600)">
              Total at risk
            </div>
            <div className="font-(family-name:--font-data) text-[20px] font-semibold text-(--color-loss-600)">
              {formatINR(totalAtRisk)}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <CollectionsTable rows={rows} />
        </div>
      </div>
    </AppShell>
  );
}
