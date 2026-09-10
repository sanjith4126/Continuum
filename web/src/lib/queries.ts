import { sql, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { requireUser } from "./auth";
import { isDate, UUID_PATTERN } from "./validation";
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
  await requireUser("dashboard");
  const rows = await db.select().from(dashboardKpis);
  return rows[0] as DashboardKpis;
}

export type LeadPipeline = {
  totalLeads: number;
  won: number;
  lost: number;
  open: number;
  conversionRate: number; // won / (won + lost), 0 when no decided leads yet
};

// Lead/conversion figures for the management dashboard -- reads the same
// enquiry table /crm already reads, just aggregated by stage. Same
// permission gate as the rest of the dashboard.
export async function getLeadPipeline(): Promise<LeadPipeline> {
  await requireUser("dashboard");
  const result = await db.execute(sql`
    select
      count(*)::int as total,
      count(*) filter (where stage = 'won')::int as won,
      count(*) filter (where stage = 'lost')::int as lost
    from enquiry
  `);
  const row = result.rows[0] as { total: number; won: number; lost: number };
  const decided = row.won + row.lost;
  return {
    totalLeads: row.total,
    won: row.won,
    lost: row.lost,
    open: row.total - decided,
    conversionRate: decided === 0 ? 0 : row.won / decided,
  };
}

export async function getBatchPnl(): Promise<BatchPnlRow[]> {
  await requireUser("dashboard");
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
  await requireUser("dashboard");
  if (!isDate(asOf)) throw new Error("Invalid historical date.");
  const result = await db.execute(
    sql`select p.batch_id as "batchId", p.name, p.revenue, p.cost,
               p.net_profit as "netProfit", b.source_lead_id as "sourceLeadId"
        from batch_pnl_asof((${asOf}::date + interval '1 day' - interval '1 microsecond') at time zone 'Asia/Kolkata') p
        left join batch b on b.id = p.batch_id
        where b.created_at <= ((${asOf}::date + interval '1 day' - interval '1 microsecond') at time zone 'Asia/Kolkata')
        order by p.net_profit`
  );
  return result.rows as unknown as BatchPnlRow[];
}

export type CollectionsAgingRow = {
  paymentId: string;
  partyId: string;
  partyName: string | null;
  batchId: string;
  batchName: string | null;
  amount: string;
  dueOn: string;
  daysOverdue: number;
  rupeesAtRisk: string;
};

export async function getCollectionsAging(): Promise<CollectionsAgingRow[]> {
  await requireUser("finance");
  const rows = await db
    .select({
      paymentId: collectionsAging.paymentId,
      partyId: collectionsAging.partyId,
      partyName: party.name,
      batchId: collectionsAging.batchId,
      batchName: batch.name,
      amount: collectionsAging.amount,
      dueOn: collectionsAging.dueOn,
      daysOverdue: collectionsAging.daysOverdue,
      rupeesAtRisk: collectionsAging.rupeesAtRisk,
    })
    .from(collectionsAging)
    .leftJoin(party, eq(party.id, collectionsAging.partyId))
    .leftJoin(batch, eq(batch.id, collectionsAging.batchId))
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
  await requireUser("trace");
  if (!UUID_PATTERN.test(leadId)) return null;
  const result = await db.execute(
    sql`select jsonb_set(jsonb_set(lead_to_outcome(${leadId}::uuid), '{invoices}',
          (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
           from invoice i join batch b on b.id = i.batch_id
           where b.source_lead_id = ${leadId}::uuid)), '{events}',
          (select coalesce(jsonb_agg(to_jsonb(le) order by le.occurred_at, le.id), '[]'::jsonb)
           from ledger_event le
           where le.batch_id in (select id from batch where source_lead_id = ${leadId}::uuid)
              or (le.entity_type = 'enquiry' and le.entity_id = ${leadId}::uuid))) as outcome`
  );
  const outcome = (result.rows[0] as { outcome: LeadOutcome } | undefined)?.outcome;
  if (!outcome || !outcome.lead) return null;
  return outcome;
}

export async function getPartyById(partyId: string) {
  await requireUser("trace");
  const rows = await db.select().from(party).where(eq(party.id, partyId));
  return rows[0] ?? null;
}

// For the /assistant demo-mode student picker only — see the identity note
// in src/app/api/assistant/route.ts. Not an auth listing; just the seeded
// students to choose "who's asking" from in a project with no real login.
export async function listStudents() {
  await requireUser("accounts");
  const rows = await db.execute(
    sql`select id, name from party where 'student' = any(roles) order by name`
  );
  return rows.rows as { id: string; name: string }[];
}

export async function getPaymentsForInvoices(invoiceIds: string[]) {
  await requireUser("trace");
  if (invoiceIds.length === 0) return [];
  return db.select().from(payment).where(inArray(payment.invoiceId, invoiceIds));
}

export async function getExpensesForBatches(batchIds: string[]) {
  await requireUser("trace");
  if (batchIds.length === 0) return [];
  return db.select().from(expense).where(inArray(expense.batchId, batchIds));
}

export async function getTrainerPaymentsForBatches(batchIds: string[]) {
  await requireUser("trace");
  if (batchIds.length === 0) return [];
  return db
    .select()
    .from(trainerPayment)
    .where(inArray(trainerPayment.batchId, batchIds));
}
