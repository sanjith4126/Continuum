import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { batchPnl, dashboardKpis, collectionsAging, batch } from "@/db/schema";

export type DashboardKpis = {
  revenue: string;
  collected: string;
  outstanding: string;
  totalCost: string;
  netProfit: string;
};

export type BatchPnlRow = {
  batchId: string;
  name: string | null;
  revenue: string;
  cost: string;
  netProfit: string;
  sourceLeadId: string | null;
};

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const rows = await db.select().from(dashboardKpis);
  return rows[0] as DashboardKpis;
}

export async function getBatchPnl(): Promise<BatchPnlRow[]> {
  const rows = await db
    .select({
      batchId: batchPnl.batchId,
      name: batchPnl.name,
      revenue: batchPnl.revenue,
      cost: batchPnl.cost,
      netProfit: batchPnl.netProfit,
      sourceLeadId: batch.sourceLeadId,
    })
    .from(batchPnl)
    .leftJoin(batch, eq(batch.id, batchPnl.batchId))
    .orderBy(batchPnl.netProfit);
  return rows as BatchPnlRow[];
}

// batch_pnl_asof(as_of timestamptz) is a SQL function, not a view — call it directly.
export async function getBatchPnlAsOf(asOf: string): Promise<BatchPnlRow[]> {
  const result = await db.execute(
    sql`select p.batch_id, p.name, p.revenue, p.cost, p.net_profit, b.source_lead_id
        from batch_pnl_asof(${asOf}::timestamptz) p
        left join batch b on b.id = p.batch_id
        order by p.net_profit`
  );
  return result.rows as unknown as BatchPnlRow[];
}

export type CollectionsAgingRow = {
  paymentId: string;
  partyId: string;
  batchId: string;
  amount: string;
  dueOn: string;
  daysOverdue: number;
  rupeesAtRisk: string;
};

export async function getCollectionsAging(): Promise<CollectionsAgingRow[]> {
  const rows = await db
    .select()
    .from(collectionsAging)
    .orderBy(sql`${collectionsAging.rupeesAtRisk} desc`);
  return rows as CollectionsAgingRow[];
}

export async function getLeadToOutcome(leadId: string) {
  const result = await db.execute(
    sql`select lead_to_outcome(${leadId}::uuid) as outcome`
  );
  return (result.rows[0] as { outcome: unknown } | undefined)?.outcome;
}
