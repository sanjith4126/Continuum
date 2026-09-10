// Typed, read-only tools for the student assistant. NO free-form SQL here
// at all — every query is hand-written and parameterised, matching
// CLAUDE.md's "typed read-only queries only" for this assistant. The
// model's only job (see route.ts) is picking which ONE of these two tools
// to call; it never sees or supplies party_id — that always comes from the
// signed-in session, never from the model or the question text.
//
// Every query here runs inside the RLS-scoped transaction helper in
// route.ts (set local role continuum_app; set local app.user_role =
// 'student'; set local app.party_id = <session's own id>) — so even if a
// bug in this file let studentId be attacker-controlled, RLS on
// enrollment/invoice/payment/invoice_line still only returns that party's
// own rows (see scripts/setup-app-role.js for the proof — including a
// check that specifically caught invoice_line leaking across students
// before RLS was enabled on it; the grant alone was not enough).

import type { PoolClient } from "pg";

export type StudentScheduleResult = {
  batches: Array<{
    batchName: string;
    courseTitle: string | null;
    status: string;
    startsOn: string | null;
    endsOn: string | null;
    nextSessionDate: string | null; // null if no future session is known
  }>;
};

export async function studentSchedule(
  client: PoolClient,
  studentId: string
): Promise<StudentScheduleResult> {
  const enrollments = await client.query(
    `select
       b.name as batch_name,
       c.title as course_title,
       b.status,
       b.starts_on,
       b.ends_on,
       e.id as enrollment_id
     from enrollment e
     join batch b on b.id = e.batch_id
     left join course c on c.id = b.course_id
     where e.student_id = $1
     order by b.starts_on nulls last`,
    [studentId]
  );

  const batches = [];
  for (const row of enrollments.rows) {
    const next = await client.query(
      `select session_date
       from attendance
       where enrollment_id = $1 and session_date >= current_date
       order by session_date asc
       limit 1`,
      [row.enrollment_id]
    );
    batches.push({
      batchName: row.batch_name,
      courseTitle: row.course_title,
      status: row.status,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      nextSessionDate: next.rows[0]?.session_date ?? null,
    });
  }

  return { batches };
}

export type StudentBalanceResult = {
  // Framed as programme/batch balance, not personal debt — see the RLS
  // policy comment in db/schema.sql: this invoice is visible to the
  // student via their enrollment, but it may be billed to a corporate
  // buyer and shared across every student on that batch.
  programmes: Array<{
    batchName: string;
    invoiceStatus: string;
    totalInvoiced: string;
    totalPaid: string;
    outstanding: string;
  }>;
};

export async function studentBalance(
  client: PoolClient,
  studentId: string
): Promise<StudentBalanceResult> {
  const rows = await client.query(
    `select
       b.name as batch_name,
       i.id as invoice_id,
       i.status as invoice_status,
       coalesce((select sum(amount - discount) from invoice_line where invoice_id = i.id), 0) as total_invoiced,
       coalesce((select sum(amount) from payment where invoice_id = i.id and paid_at is not null), 0) as total_paid
     from enrollment e
     join batch b on b.id = e.batch_id
     join invoice i on i.batch_id = b.id
     where e.student_id = $1`,
    [studentId]
  );

  return {
    programmes: rows.rows.map((r) => ({
      batchName: r.batch_name,
      invoiceStatus: r.invoice_status,
      totalInvoiced: r.total_invoiced,
      totalPaid: r.total_paid,
      outstanding: (Number(r.total_invoiced) - Number(r.total_paid)).toFixed(2),
    })),
  };
}
