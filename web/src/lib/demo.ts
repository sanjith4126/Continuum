"use server";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  createLead,
  convertLead,
  createBatch,
  enrollStudent,
  raiseInvoice,
  recordPayment,
  recordExpense,
  recordTrainerPayment,
} from "./actions";

export type PipelineStep = {
  step: string;
  detail: string;
};

// Walks ONE full journey — lead to margin — using the same server actions the
// real UI would call. Every step appends its ledger_event, so the new batch
// shows up in batch_pnl (and in batch_pnl_asof once its dates pass).
export async function runDemoPipeline(): Promise<{
  steps: PipelineStep[];
  leadId: string;
  batchId: string;
  netProfit: string;
}> {
  const stamp = new Date().toISOString().slice(11, 19);
  const steps: PipelineStep[] = [];

  // reuse seeded course / trainer / student so we don't invent an LMS catalogue
  const course = await db.execute(sql`select id, title from course limit 1`);
  const trainer = await db.execute(
    sql`select id, name from party where 'trainer' = any(roles) limit 1`
  );
  const student = await db.execute(
    sql`select id, name from party where 'student' = any(roles) limit 1`
  );

  const courseId = (course.rows[0] as { id: string }).id;
  const trainerId = (trainer.rows[0] as { id: string }).id;
  const studentId = (student.rows[0] as { id: string }).id;

  const lead = await createLead({
    name: `Demo Corp ${stamp}`,
    kind: "org",
    email: "ops@democorp.example",
    source: "website",
    sourceCost: "3000",
  });
  steps.push({ step: "createLead", detail: `enquiry ${lead.enquiryId.slice(0, 8)}` });

  await convertLead({ enquiryId: lead.enquiryId });
  steps.push({ step: "convertLead", detail: "stage → won" });

  const b = await createBatch({
    courseId,
    name: `Demo Corp — Advanced Python ${stamp}`,
    sourceLeadId: lead.enquiryId,
    trainerId,
    location: "Chennai",
    status: "running",
  });
  steps.push({ step: "createBatch", detail: `batch ${b.batchId.slice(0, 8)}` });

  const en = await enrollStudent({ batchId: b.batchId, studentId });
  steps.push({
    step: "enrollStudent",
    detail: `enrollment ${en.enrollmentId.slice(0, 8)}`,
  });

  const inv = await raiseInvoice({
    partyId: lead.partyId,
    batchId: b.batchId,
    amount: "250000",
    description: "12 seats × Advanced Python",
  });
  steps.push({
    step: "raiseInvoice",
    detail: `invoice ${inv.invoiceId.slice(0, 8)} · ₹2,50,000`,
  });

  await recordPayment({
    invoiceId: inv.invoiceId,
    batchId: b.batchId,
    amount: "150000",
    method: "bank",
    paid: true,
  });
  steps.push({ step: "recordPayment", detail: "₹1,50,000 received" });

  await recordPayment({
    invoiceId: inv.invoiceId,
    batchId: b.batchId,
    amount: "100000",
    method: "bank",
    dueOn: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
    paid: false,
  });
  steps.push({ step: "recordPayment", detail: "₹1,00,000 outstanding (aging)" });

  await recordExpense({
    batchId: b.batchId,
    category: "venue",
    vendor: "WeWork Chennai",
    amount: "40000",
  });
  steps.push({ step: "recordExpense", detail: "venue ₹40,000" });

  await recordExpense({
    batchId: b.batchId,
    category: "marketing",
    vendor: "Website ads",
    amount: "3000",
  });
  steps.push({ step: "recordExpense", detail: "marketing ₹3,000" });

  await recordTrainerPayment({
    batchId: b.batchId,
    trainerId,
    amount: "90000",
  });
  steps.push({ step: "recordTrainerPayment", detail: "₹90,000" });

  const pnl = await db.execute(
    sql`select net_profit from batch_pnl where batch_id = ${b.batchId}::uuid`
  );
  const netProfit = String(
    (pnl.rows[0] as { net_profit: string } | undefined)?.net_profit ?? "0"
  );

  return { steps, leadId: lead.enquiryId, batchId: b.batchId, netProfit };
}
