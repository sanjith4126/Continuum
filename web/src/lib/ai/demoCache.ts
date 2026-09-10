// Pre-scripted SQL for the two demo questions named in CLAUDE.md /
// BUILD_PLAN.md ("which batches lost money this quarter?" and, by user
// decision, "what's our total net profit?"). These exist so the consultant
// still works if Groq is slow or down mid-pitch.
//
// IMPORTANT: a cache hit skips the model AND the SQL validator (sqlGuard's
// regex checks, runAiQuery's EXPLAIN check) entirely — no call to Groq, no
// validation round trip. See matchDemoCache() and its call site in the
// /consultant route: the cache check happens first, before anything else.
// This is deliberate and safe ONLY because every `sql` value below is a
// plain string literal, written by a human in this file, with ZERO runtime
// interpolation — no date, no filter, no request-derived value is ever
// concatenated into it. There is nothing dynamic here for the validator to
// check, so routing it through validateSqlStatic/EXPLAIN would be pure
// overhead. If a future cache entry ever needs to build its SQL from any
// value that isn't a compile-time constant, it MUST go through
// runAiQuery() instead of executeDemoSql() below — do not bypass the
// validator for anything the model, a user, or a request touched.
//
// What this does NOT skip is the database read: the SQL still runs live
// against continuum_ai in a read-only transaction, and the answer is
// formatted from the real returned rows. This is intentional — an earlier
// version of this cache hardcoded the answer TEXT ("net profit is
// ₹70,000") and that number silently went stale the moment demo/test data
// changed underneath it (it read ₹3,04,000 for a while after a Phase 3
// test run). Computing the number from the fixed query at request time
// means the cached answer can never drift from what the dashboard shows.

import { pool } from "@/db";
import { formatINR } from "@/lib/format";

const STATEMENT_TIMEOUT_MS = 5000;

/**
 * Runs a fixed, human-written SQL string directly as continuum_ai, with NO
 * validation pass — safe only for the compile-time-constant strings in
 * DEMO_CACHE below (see the file header). Do not export this for any other
 * use.
 */
async function executeDemoSql(sql: string): Promise<Record<string, unknown>[]> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role continuum_ai");
    await client.query("set local transaction read only");
    await client.query(`set local statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    const result = await client.query(sql);
    await client.query("rollback");
    return result.rows;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export type DemoCacheEntry = {
  match: (question: string) => boolean;
  sql: string;
  formatAnswer: (rows: Record<string, unknown>[]) => string;
};

function normalize(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

// Matches on keyword sets rather than exact string equality, so small
// rephrasings ("which batches are losing money?", "any batches lost money
// this quarter") still hit the cache instead of falling through to a live
// call for what is obviously the same scripted question.
export const DEMO_CACHE: DemoCacheEntry[] = [
  {
    match: (q) => {
      const n = normalize(q);
      return (
        n.includes("lost money") ||
        n.includes("losing money") ||
        (n.includes("batch") && (n.includes("loss") || n.includes("negative")))
      );
    },
    sql: "select name, revenue, cost, net_profit from batch_pnl where net_profit < 0 order by net_profit asc limit 100",
    formatAnswer: (rows) => {
      if (rows.length === 0) return "No batches are currently unprofitable.";
      const lines = rows.map(
        (r) =>
          `${r.name} at ${formatINR(String(r.net_profit))} (${formatINR(String(r.revenue))} revenue against ${formatINR(String(r.cost))} cost)`
      );
      return `${rows.length === 1 ? "One batch is" : `${rows.length} batches are`} currently unprofitable: ${lines.join("; ")}.`;
    },
  },
  {
    match: (q) => {
      const n = normalize(q);
      return n.includes("total net profit") || (n.includes("net profit") && !n.includes("batch"));
    },
    sql: "select net_profit from dashboard_kpis",
    formatAnswer: (rows) =>
      `Total net profit across all batches is ${formatINR(String(rows[0]?.net_profit ?? 0))}.`,
  },
];

export function matchDemoCache(question: string): DemoCacheEntry | null {
  for (const entry of DEMO_CACHE) {
    if (entry.match(question)) return entry;
  }
  return null;
}

export type DemoCacheResult =
  | { ok: true; answer: string; sql: string; rows: Record<string, unknown>[] }
  | { ok: false; reason: string };

/**
 * Runs a matched cache entry's fixed SQL live (as continuum_ai, read-only,
 * via executeDemoSql — NOT runAiQuery, and NOT validateSqlStatic) and
 * formats the answer from the real rows. The model is never in this loop:
 * matchDemoCache() found the entry from keyword matching on the question
 * text alone, and entry.sql is a constant from this file, never anything
 * the question text contributed.
 */
export async function resolveDemoCacheEntry(
  entry: DemoCacheEntry
): Promise<DemoCacheResult> {
  try {
    const rows = await executeDemoSql(entry.sql);
    return { ok: true, answer: entry.formatAnswer(rows), sql: entry.sql, rows };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
