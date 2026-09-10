import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { askAssistant } from "@/lib/ai/assistant";

// DEMO-MODE IDENTITY NOTE: this project has no real auth/session system
// (out of scope for the build plan). The client sends a studentId picked
// from a dropdown of seeded students — that is genuinely client-supplied
// input, not a verified login, and this route does not pretend otherwise.
// What IS enforced, independent of trusting that input as a real identity:
//   1. studentId is validated here against the actual set of student
//      party_ids in the DB before it goes anywhere near a query — an
//      unrecognised value is rejected, never passed through as opaque text.
//   2. Whatever studentId is accepted becomes app.party_id for an
//      RLS-scoped, continuum_app-run transaction (see askAssistant ->
//      runAsStudent). RLS then enforces that THIS party can only ever see
//      its own rows, regardless of which real student picked it in the
//      demo UI — see scripts/setup-app-role.js for the empirical proof.
// In a production version, studentId would come from a verified session
// (e.g. a signed cookie / JWT), not a request body field, and the
// allowlist check below would be replaced by that session lookup — the
// RLS enforcement in step 2 stays exactly the same either way.
async function isRealStudent(studentId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(studentId)) return false;
  const result = await db.execute(
    sql`select 1 from party where id = ${studentId}::uuid and 'student' = any(roles) limit 1`
  );
  return result.rows.length > 0;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  const studentId = (body as { studentId?: unknown })?.studentId;
  const question = (body as { question?: unknown })?.question;

  if (typeof studentId !== "string" || typeof question !== "string") {
    return NextResponse.json(
      { ok: false, message: "Missing studentId or question." },
      { status: 400 }
    );
  }

  if (!(await isRealStudent(studentId))) {
    return NextResponse.json({ ok: false, message: "Unknown student." }, { status: 400 });
  }

  const result = await askAssistant(studentId, question);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
