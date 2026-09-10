"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { authorizedTransaction, currentActor, type Tx } from "./transaction";
import { requireMoney, requireText, requireUuid, isDate } from "./validation";
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
    actorId: currentActor(),
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
  requireText(input.name, "name");
  if (input.kind !== undefined && !["person", "org"].includes(input.kind)) throw new Error("Invalid party kind.");
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error("Invalid email.");
  requireMoney(input.sourceCost ?? "0", "source cost", true);
  return authorizedTransaction("crm", async (tx) => {
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
        ownerId: currentActor(),
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
  requireUuid(input.enquiryId, "enquiry ID");
  return authorizedTransaction("crm", async (tx) => {
    const [existing] = await tx.select().from(enquiry).where(eq(enquiry.id, input.enquiryId)).for("update");
    if (!existing) throw new Error("Lead not found.");
    if (existing.stage === "won") return { enquiryId: existing.id };
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
  requireUuid(input.courseId, "course ID");
  requireText(input.name, "batch name");
  if (input.sourceLeadId) requireUuid(input.sourceLeadId, "lead ID");
  if (input.trainerId) requireUuid(input.trainerId, "trainer ID");
  if (input.startsOn && !isDate(input.startsOn)) throw new Error("Invalid start date.");
  if (input.endsOn && !isDate(input.endsOn)) throw new Error("Invalid end date.");
  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn) throw new Error("End date must follow start date.");
  return authorizedTransaction("trainingWrite", async (tx) => {
    if (input.trainerId) {
      const [trainer] = await tx.select().from(party).where(eq(party.id,input.trainerId));
      if (!trainer?.roles.includes("trainer")) throw new Error("Trainer not found.");
    }
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
  requireUuid(input.batchId, "batch ID");
  requireUuid(input.studentId, "student ID");
  return authorizedTransaction("trainingWrite", async (tx) => {
    const [student] = await tx.select().from(party).where(eq(party.id, input.studentId));
    if (!student?.roles?.includes("student")) throw new Error("Student not found.");
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
  requireUuid(input.partyId, "party ID");
  requireUuid(input.batchId, "batch ID");
  requireMoney(input.amount, "invoice amount");
  requireMoney(input.discount ?? "0", "discount", true);
  requireMoney(input.gstRate ?? "18", "GST rate", true);
  if (Number(input.discount ?? 0) > Number(input.amount)) throw new Error("Discount exceeds invoice amount.");
  if (Number(input.gstRate ?? 18) > 100) throw new Error("Invalid GST rate.");
  return authorizedTransaction("finance", async (tx) => {
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
  requireUuid(input.invoiceId, "invoice ID");
  requireUuid(input.batchId, "batch ID");
  requireMoney(input.amount, "payment amount");
  if (input.paid !== undefined && typeof input.paid !== "boolean") throw new Error("Invalid payment state.");
  if (input.dueOn && !isDate(input.dueOn)) throw new Error("Invalid due date.");
  return authorizedTransaction("finance", async (tx) => {
    const [inv] = await tx.select().from(invoice).where(eq(invoice.id, input.invoiceId)).for("update");
    if (!inv || inv.batchId !== input.batchId) throw new Error("Invoice does not belong to this batch.");
    if (inv.status === "void") throw new Error("Cannot pay a void invoice.");
    const totals=await tx.execute(sql`select
      (select coalesce(sum(amount-discount),0) from invoice_line where invoice_id=${input.invoiceId}::uuid) as invoiced,
      (select coalesce(sum(amount),0) from payment where invoice_id=${input.invoiceId}::uuid) as allocated`);
    if (Number(totals.rows[0].allocated)+Number(input.amount)>Number(totals.rows[0].invoiced)+0.001) {
      throw new Error("This exceeds the unallocated invoice balance. Settle an existing installment instead.");
    }
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
      payload: { amount: input.amount, method: input.method ?? "bank", paid: input.paid !== false, dueOn: input.dueOn ?? null },
    });

    if (input.paid !== false) {
      await tx.execute(sql`update invoice set status=case
        when (select coalesce(sum(amount),0) from payment where invoice_id=${input.invoiceId}::uuid and paid_at is not null)
          >= (select coalesce(sum(amount-discount),0) from invoice_line where invoice_id=${input.invoiceId}::uuid)
        then 'paid'::invoice_status else 'part_paid'::invoice_status end where id=${input.invoiceId}::uuid`);
    }

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
  requireUuid(input.batchId, "batch ID");
  requireMoney(input.amount, "expense amount");
  return authorizedTransaction("finance", async (tx) => {
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
  requireUuid(input.batchId, "batch ID");
  requireUuid(input.trainerId, "trainer ID");
  requireMoney(input.amount, "trainer payment amount");
  return authorizedTransaction("finance", async (tx) => {
    const [trainer] = await tx.select().from(party).where(eq(party.id, input.trainerId));
    if (!trainer?.roles?.includes("trainer")) throw new Error("Trainer not found.");
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
