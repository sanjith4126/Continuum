// Executes an AI-generated SQL string with the full defence-in-depth stack:
//   1. static regex validation (sqlGuard.ts) — cheap, fails closed, checks
//      the statement shape (single SELECT, no comments, no semicolons, only
//      the three whitelisted views named after FROM/JOIN, only the five
//      allowed functions).
//   2. EXPLAIN (FORMAT JSON) the query as continuum_ai, using Postgres's
//      own parser. This is a syntax/parse gate, NOT a second relation
//      whitelist: EXPLAIN on a query against a view reports the view's
//      underlying base tables (batch, invoice_line, expense,
//      trainer_payment, payment, invoice, ...) as "Relation Name" nodes,
//      not the view name itself, because the planner expands view
//      definitions before producing a plan. Verified live against Neon:
//      `explain (format json) select * from batch_pnl` as continuum_ai
//      returns Relation Name nodes for batch/invoice_line/expense/
//      trainer_payment. Whitelisting against exactly {batch_pnl,
//      collections_aging, dashboard_kpis} at this layer would reject every
//      legitimate query, so this layer does NOT re-check relation names —
//      that job belongs entirely to layer 3, which is the correct and
//      already-proven boundary (continuum_ai has zero grants on those base
//      tables directly; see scripts/setup-ai-role.js). What EXPLAIN adds
//      here is real value regex can't: it fails clearly on anything that
//      doesn't parse as valid SQL before we spend a real execution on it.
//   3. run it as continuum_ai, inside `transaction read only`, with a
//      statement timeout — the actual security boundary. A bypass of
//      layers 1-2 still can't read or write anything the role wasn't
//      granted; that's what scripts/setup-ai-role.js proves empirically.
import { pool } from "@/db";
import { validateSqlStatic } from "./sqlGuard";

export type AiQueryResult =
  | { ok: true; rows: Record<string, unknown>[]; sql: string }
  | { ok: false; reason: string };

const STATEMENT_TIMEOUT_MS = 5000;
const MAX_ROWS = 1000;

export async function runAiQuery(rawSql: string): Promise<AiQueryResult> {
  const staticCheck = validateSqlStatic(rawSql);
  if (!staticCheck.ok) {
    return { ok: false, reason: staticCheck.reason };
  }
  const sql = staticCheck.sql;

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role continuum_ai");
    await client.query("set local transaction read only");
    await client.query(`set local statement_timeout = ${STATEMENT_TIMEOUT_MS}`);

    // Layer 2: confirm the query actually parses/plans before running it for
    // real. See the file header — this intentionally does NOT re-check
    // relation names against the view whitelist; that check belongs to the
    // database grants (layer 3), which are the real, already-proven
    // boundary. This EXPLAIN call runs as continuum_ai too, so even its
    // planning step can't see or touch anything the role isn't granted.
    try {
      await client.query(`explain (format json) ${sql}`);
    } catch (err) {
      await client.query("rollback");
      return {
        ok: false,
        reason: `query does not parse: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const result = await client.query(sql);
    await client.query("rollback"); // read-only: nothing to commit, and this
    // guarantees SET LOCAL ROLE never survives past this call even on error paths.

    return { ok: true, rows: result.rows.slice(0, MAX_ROWS), sql };
  } catch (err) {
    await client.query("rollback").catch(() => {});
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  } finally {
    client.release();
  }
}
