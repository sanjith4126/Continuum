// Orchestrates one student-assistant question end to end. NO free-form SQL
// anywhere in this file or in studentTools.ts — Groq's only job is routing
// the question to exactly one of two typed tools (student_schedule,
// student_balance). It never sees, generates, or supplies party_id: that
// always comes from the caller's own session (the `studentId` parameter
// here), so no amount of prompt injection in the question text can make
// this answer about a different student — the tool call is parameterless
// from the model's point of view.
import { chatWithFallback } from "./groq";
import { pool } from "@/db";
import { studentSchedule, studentBalance } from "./studentTools";
import type { StudentScheduleResult, StudentBalanceResult } from "./studentTools";
import { formatINR } from "@/lib/format";

const ROUTER_SYSTEM_PROMPT = `You route a student's question to exactly one tool. Reply with ONLY one
of these two words, nothing else:

SCHEDULE  -- the question is about classes, sessions, batches, or "when"
BALANCE   -- the question is about money, fees, payment, or balance

If genuinely ambiguous, prefer SCHEDULE. Reply with exactly one word.`;

export type AssistantResponse =
  | { ok: true; answer: string; tool: "schedule" | "balance" }
  | { ok: false; message: string };

function formatScheduleAnswer(result: StudentScheduleResult): string {
  if (result.batches.length === 0) {
    return "You're not currently enrolled in any batch.";
  }
  const parts = result.batches.map((b) => {
    const course = b.courseTitle ? ` (${b.courseTitle})` : "";
    if (b.nextSessionDate) {
      return `${b.batchName}${course}: next session on ${new Date(b.nextSessionDate).toLocaleDateString("en-IN", { dateStyle: "medium" })}`;
    }
    if (b.status === "completed") {
      return `${b.batchName}${course}: this programme has completed — no upcoming sessions`;
    }
    return `${b.batchName}${course}: no upcoming session is scheduled yet`;
  });
  return parts.join(". ") + ".";
}

function formatBalanceAnswer(result: StudentBalanceResult): string {
  if (result.programmes.length === 0) {
    return "No billing found for your programme yet.";
  }
  const parts = result.programmes.map((p) => {
    const outstanding = Number(p.outstanding);
    if (outstanding <= 0) {
      return `${p.batchName}: fully paid (${formatINR(p.totalInvoiced)} invoiced)`;
    }
    return `${p.batchName}: ${formatINR(p.outstanding)} outstanding of ${formatINR(p.totalInvoiced)} invoiced — this is your programme's shared balance, not personal debt`;
  });
  return parts.join(". ") + ".";
}

/**
 * Runs `fn` inside a transaction scoped by RLS to `studentId` — running as
 * continuum_app (which does NOT bypass RLS, unlike the app's normal
 * neondb_owner connection — see scripts/setup-app-role.js). Always rolls
 * back (read-only, nothing to commit) so the role/session vars never
 * survive past this call on a pooled connection.
 */
async function runAsStudent<T>(
  studentId: string,
  fn: (client: import("pg").PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role continuum_app");
    await client.query("set local transaction read only");
    await client.query("set local statement_timeout = 5000");
    await client.query("set local app.user_role = 'student'");
    await client.query("select set_config('app.party_id', $1, true)", [studentId]);
    const result = await fn(client);
    await client.query("rollback");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function askAssistant(
  studentId: string,
  question: string
): Promise<AssistantResponse> {
  const trimmed = question.trim();
  if (!trimmed) {
    return { ok: false, message: "Ask a question first." };
  }
  if (trimmed.length > 300) {
    return { ok: false, message: "Question is too long." };
  }

  let route: string;
  try {
    route = (
      await chatWithFallback(
        "assistant",
        [
          { role: "system", content: ROUTER_SYSTEM_PROMPT },
          { role: "user", content: trimmed },
        ],
        400
      )
    )
      .trim()
      .toUpperCase();
  } catch {
    // Router failure: fall back to a simple keyword heuristic rather than
    // failing the whole request — this is a routing decision between two
    // safe, already-scoped tools, not a security-sensitive path.
    route = /balance|fee|pay|owe|due|money|₹|rupee/i.test(trimmed) ? "BALANCE" : "SCHEDULE";
  }

  try {
    if (route.includes("BALANCE")) {
      const result = await runAsStudent(studentId, (client) =>
        studentBalance(client, studentId)
      );
      return { ok: true, answer: formatBalanceAnswer(result), tool: "balance" };
    }
    const result = await runAsStudent(studentId, (client) =>
      studentSchedule(client, studentId)
    );
    return { ok: true, answer: formatScheduleAnswer(result), tool: "schedule" };
  } catch (err) {
    console.error("[assistant] query failed:", err instanceof Error ? err.message : err);
    return { ok: false, message: "Couldn't answer that right now. Please try again." };
  }
}
