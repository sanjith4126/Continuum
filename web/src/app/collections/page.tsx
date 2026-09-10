import Link from "next/link";
import { CollectionsTable } from "@/components/CollectionsTable";
import { getCollectionsAging } from "@/lib/queries";
import { formatINR } from "@/lib/format";

export default async function CollectionsPage() {
  const rows = await getCollectionsAging();
  const totalAtRisk = rows.reduce((sum, r) => sum + Number(r.rupeesAtRisk), 0);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Link
          href="/dashboard"
          className="text-sm text-neutral-400 hover:text-neutral-900"
        >
          ← Dashboard
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              Collections
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Outstanding installments ranked by rupees at risk.
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-neutral-500">
              Total at risk
            </div>
            <div className="text-2xl font-semibold text-rose-600">
              {formatINR(totalAtRisk)}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <CollectionsTable rows={rows} />
        </div>
      </div>
    </div>
  );
}
