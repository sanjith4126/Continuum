import { sql, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  batchPnl,
  dashboardKpis,
  collectionsAging,
  batch,
  party,
  payment,
  expense,
  trainerPayment,
} from "@/db/schema";

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

export type LeadOutcomeEvent = {
  id: number;
  amount: string | null;
  payload: Record<string, unknown>;
  actor_id: string | null;
  batch_id: string | null;
  entity_id: string | null;
  event_type: string;
  entity_type: string;
  occurred_at: string;
};

export type LeadOutcome = {
  lead: {
    id: string;
    stage: string;
    source: string | null;
    owner_id: string | null;
    party_id: string;
    created_at: string;
    source_cost: string;
  } | null;
  batches: Array<{
    id: string;
    name: string;
    status: string;
    ends_on: string | null;
    location: string | null;
    course_id: string;
    starts_on: string | null;
    created_at: string;
    trainer_id: string | null;
    source_lead_id: string | null;
  }>;
  invoices: Array<{
    id: string;
    status: string;
    batch_id: string | null;
    gst_rate: string;
    party_id: string;
    issued_at: string;
  }>;
  // pnl comes from jsonb_agg(to_jsonb(batch_pnl row)) inside the SQL function,
  // so its keys are the view's raw snake_case column names, not the camelCase
  // BatchPnlRow used elsewhere in the app.
  pnl: Array<{
    batch_id: string;
    name: string | null;
    revenue: string;
    cost: string;
    net_profit: string;
  }>;
  events: LeadOutcomeEvent[];
};

export async function getLeadToOutcome(leadId: string): Promise<LeadOutcome | null> {
  const result = await db.execute(
    sql`select lead_to_outcome(${leadId}::uuid) as outcome`
  );
  const outcome = (result.rows[0] as { outcome: LeadOutcome } | undefined)?.outcome;
  if (!outcome || !outcome.lead) return null;
  return outcome;
}

export async function getPartyById(partyId: string) {
  const rows = await db.select().from(party).where(eq(party.id, partyId));
  return rows[0] ?? null;
}

export async function getPaymentsForInvoices(invoiceIds: string[]) {
  if (invoiceIds.length === 0) return [];
  return db.select().from(payment).where(inArray(payment.invoiceId, invoiceIds));
}

export async function getExpensesForBatches(batchIds: string[]) {
  if (batchIds.length === 0) return [];
  return db.select().from(expense).where(inArray(expense.batchId, batchIds));
}

export async function getTrainerPaymentsForBatches(batchIds: string[]) {
  if (batchIds.length === 0) return [];
  return db
    .select()
    .from(trainerPayment)
    .where(inArray(trainerPayment.batchId, batchIds));
}
