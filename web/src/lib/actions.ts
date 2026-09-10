"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  party,
  enquiry,
  batch,
  enrollment,
  invoice,
  invoiceLine,
  payment,
  expense,
  trainerPayment,
  ledgerEvent,
} from "@/db/schema";

// Every write below runs in a transaction that also appends a ledger_event.
// Money events carry batch_id and a signed amount (+revenue, -cost) so the
// as-of P&L in batch_pnl_asof() can be reconstructed from the log.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function appendEvent(
  tx: Tx,
  event: {
    eventType:
      | "lead.created"
      | "lead.converted"
      | "batch.created"
      | "enrollment.created"
      | "invoice.raised"
      | "invoice.line_added"
      | "payment.received"
      | "expense.recorded"
      | "trainer_payment.recorded";
    entityType: string;
    entityId?: string | null;
    batchId?: string | null;
    amount?: string | null;
    payload?: Record<string, unknown>;
  }
) {
  await tx.insert(ledgerEvent).values({
    eventType: event.eventType,
    entityType: event.entityType,
    entityId: event.entityId ?? null,
    batchId: event.batchId ?? null,
    amount: event.amount ?? null,
    payload: event.payload ?? {},
  });
}

export async function createLead(input: {
  name: string;
  kind?: "person" | "org";
  email?: string;
  phone?: string;
  source?: string;
  sourceCost?: string;
}) {
  return db.transaction(async (tx) => {
    const [p] = await tx
      .insert(party)
      .values({
        kind: input.kind ?? "org",
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        roles: ["corporate_buyer"],
      })
      .returning();

    const [e] = await tx
      .insert(enquiry)
      .values({
        partyId: p.id,
        source: input.source ?? null,
        sourceCost: input.sourceCost ?? "0",
        stage: "new",
      })
      .returning();

    await appendEvent(tx, {
      eventType: "lead.created",
      entityType: "enquiry",
      entityId: e.id,
      payload: { source: input.source ?? null, party: p.name },
    });

    revalidatePath("/dashboard");
    return { partyId: p.id, enquiryId: e.id };
  });
}

export async function convertLead(input: { enquiryId: string }) {
  return db.transaction(async (tx) => {
    const [e] = await tx
      .update(enquiry)
      .set({ stage: "won" })
      .where(eq(enquiry.id, input.enquiryId))
      .returning();

    await appendEvent(tx, {
      eventType: "lead.converted",
      entityType: "enquiry",
      entityId: e.id,
      payload: {},
    });

    revalidatePath("/dashboard");
    return { enquiryId: e.id };
  });
}

export async function createBatch(input: {
  courseId: string;
  name: string;
  sourceLeadId?: string;
  trainerId?: string;
  location?: string;
  startsOn?: string;
  endsOn?: string;
  status?: "planned" | "running" | "completed" | "cancelled";
}) {
  return db.transaction(async (tx) => {
    const [b] = await tx
      .insert(batch)
      .values({
        courseId: input.courseId,
        name: input.name,
        sourceLeadId: input.sourceLeadId ?? null,
        trainerId: input.trainerId ?? null,
        location: input.location ?? null,
        startsOn: input.startsOn ?? null,
        endsOn: input.endsOn ?? null,
        status: input.status ?? "planned",
      })
      .returning();

    await appendEvent(tx, {
      eventType: "batch.created",
      entityType: "batch",
      entityId: b.id,
      batchId: b.id,
      payload: { name: b.name },
    });

    revalidatePath("/dashboard");
    return { batchId: b.id };
  });
}

export async function enrollStudent(input: {
  batchId: string;
  studentId: string;
}) {
  return db.transaction(async (tx) => {
    const [en] = await tx
      .insert(enrollment)
      .values({ batchId: input.batchId, studentId: input.studentId })
      .returning();

    await appendEvent(tx, {
      eventType: "enrollment.created",
      entityType: "enrollment",
      entityId: en.id,
      batchId: input.batchId,
      payload: { studentId: input.studentId },
    });

    revalidatePath("/dashboard");
    return { enrollmentId: en.id };
  });
}

export async function raiseInvoice(input: {
  partyId: string;
  batchId: string;
  amount: string;
  description?: string;
  discount?: string;
  gstRate?: string;
}) {
  return db.transaction(async (tx) => {
    const [inv] = await tx
      .insert(invoice)
      .values({
        partyId: input.partyId,
        batchId: input.batchId,
        status: "issued",
        gstRate: input.gstRate ?? "18",
      })
      .returning();

    const [line] = await tx
      .insert(invoiceLine)
      .values({
        invoiceId: inv.id,
        batchId: input.batchId,
        description: input.description ?? null,
        amount: input.amount,
        discount: input.discount ?? "0",
      })
      .returning();

    // revenue is positive on the ledger
    const net = (Number(input.amount) - Number(input.discount ?? 0)).toFixed(2);

    await appendEvent(tx, {
      eventType: "invoice.raised",
      entityType: "invoice",
      entityId: inv.id,
      batchId: input.batchId,
      amount: net,
      payload: { gst_rate: input.gstRate ?? "18" },
    });

    await appendEvent(tx, {
      eventType: "invoice.line_added",
      entityType: "invoice_line",
      entityId: line.id,
      batchId: input.batchId,
      amount: net,
      payload: { description: input.description ?? null },
    });

    revalidatePath("/dashboard");
    return { invoiceId: inv.id, invoiceLineId: line.id };
  });
}

export async function recordPayment(input: {
  invoiceId: string;
  batchId: string;
  amount: string;
  method?: string;
  dueOn?: string;
  paid?: boolean;
}) {
  return db.transaction(async (tx) => {
    const [pay] = await tx
      .insert(payment)
      .values({
        invoiceId: input.invoiceId,
        amount: input.amount,
        method: input.method ?? "bank",
        dueOn: input.dueOn ?? null,
        paidAt: input.paid === false ? null : new Date().toISOString(),
      })
      .returning();

    await appendEvent(tx, {
      eventType: "payment.received",
      entityType: "payment",
      entityId: pay.id,
      batchId: input.batchId,
      // cash movement, not revenue — revenue was already booked on the invoice
      // line, so this stays out of the signed P&L amount to avoid double count
      amount: null,
      payload: { amount: input.amount, method: input.method ?? "bank" },
    });

    revalidatePath("/dashboard");
    revalidatePath("/collections");
    return { paymentId: pay.id };
  });
}

export async function recordExpense(input: {
  batchId: string;
  category:
    | "trainer_fee"
    | "venue"
    | "travel"
    | "materials"
    | "marketing"
    | "other";
  amount: string;
  vendor?: string;
}) {
  return db.transaction(async (tx) => {
    const [ex] = await tx
      .insert(expense)
      .values({
        batchId: input.batchId,
        category: input.category,
        vendor: input.vendor ?? null,
        amount: input.amount,
      })
      .returning();

    await appendEvent(tx, {
      eventType: "expense.recorded",
      entityType: "expense",
      entityId: ex.id,
      batchId: input.batchId,
      amount: `-${Number(input.amount).toFixed(2)}`, // cost is negative
      payload: { category: input.category, vendor: input.vendor ?? null },
    });

    revalidatePath("/dashboard");
    return { expenseId: ex.id };
  });
}

export async function recordTrainerPayment(input: {
  batchId: string;
  trainerId: string;
  amount: string;
}) {
  return db.transaction(async (tx) => {
    const [tp] = await tx
      .insert(trainerPayment)
      .values({
        batchId: input.batchId,
        trainerId: input.trainerId,
        amount: input.amount,
      })
      .returning();

    await appendEvent(tx, {
      eventType: "trainer_payment.recorded",
      entityType: "trainer_payment",
      entityId: tp.id,
      batchId: input.batchId,
      amount: `-${Number(input.amount).toFixed(2)}`, // cost is negative
      payload: { trainerId: input.trainerId },
    });

    revalidatePath("/dashboard");
    return { trainerPaymentId: tp.id };
  });
}
