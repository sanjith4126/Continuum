// Validates AI-generated SQL before it is ever executed. Layered, allowlist
// shaped, fail-closed. See CLAUDE.md "Security conventions" — the AI is
// read-only and least-privilege; this is the code that keeps that true.
//
// This validator is defence-in-depth, NOT the actual security boundary.
// The real boundary is the continuum_ai database role (see
// scripts/setup-ai-role.js) which has SELECT on exactly three views and
// nothing else, runs inside `transaction read only`, and is proven by
// automated checks to reject every write and every base-table read. If
// this validator has a bypass, the role still stops it. Layer 2b below
// (EXPLAIN-based checking) additionally uses Postgres's own parser rather
// than this file's regexes, specifically to catch what regex can miss.

export const WHITELISTED_VIEWS = [
  "batch_pnl",
  "collections_aging",
  "dashboard_kpis",
] as const;

export type ValidationResult =
  | { ok: true; sql: string }
  | { ok: false; reason: string };

const FORBIDDEN_KEYWORDS =
  /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|call|do|set|vacuum|analyze|reindex|refresh|lock|listen|notify|prepare|execute|merge)\b/i;

// SUM/COUNT/AVG/MIN/MAX/ROUND are explicitly allowed (the system prompt says
// so too) — they're plain aggregate/scalar functions with no side effects.
// Everything else that looks like a function call is rejected below.
const ALLOWED_FUNCTIONS = new Set(["sum", "count", "avg", "min", "max", "round"]);

const FORBIDDEN_SUBSTRINGS = [
  "pg_read_file",
  "pg_ls_dir",
  "dblink",
  "lo_import",
  "lo_export",
  "current_setting",
  "set_config",
  "pg_sleep",
  "pg_terminate_backend",
  "$$", // dollar-quoting: how you smuggle a function body
];

const MAX_LENGTH = 2000;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

/**
 * Static (regex-level) validation. Cheap, runs before any DB round trip.
 * Fails closed: anything not explicitly recognised as safe is rejected.
 */
export function validateSqlStatic(rawSql: string): ValidationResult {
  let sql = rawSql.trim();

  if (sql.length === 0) {
    return { ok: false, reason: "empty query" };
  }
  if (sql.length > MAX_LENGTH) {
    return { ok: false, reason: "query too long" };
  }

  // Reject comments outright — the standard way to smuggle payloads past a
  // naive check ("SELECT 1 -- ; DROP TABLE ...").
  if (sql.includes("--") || sql.includes("/*")) {
    return { ok: false, reason: "comments are not allowed" };
  }

  // Strip exactly one optional trailing semicolon, then any remaining ';'
  // means multiple statements — reject.
  sql = sql.replace(/;\s*$/, "");
  if (sql.includes(";")) {
    return { ok: false, reason: "multiple statements are not allowed" };
  }

  // Must be a bare SELECT. No CTEs: `WITH x AS (INSERT ... RETURNING *)
  // SELECT * FROM x` is a write disguised as a SELECT, and allowing WITH
  // means parsing it properly to stay safe. Banning it is cheaper and safer.
  if (!/^select\b/i.test(sql)) {
    return { ok: false, reason: "only a single SELECT statement is allowed" };
  }

  if (FORBIDDEN_KEYWORDS.test(sql)) {
    return { ok: false, reason: "query contains a forbidden keyword" };
  }

  const lowerSql = sql.toLowerCase();
  for (const bad of FORBIDDEN_SUBSTRINGS) {
    if (lowerSql.includes(bad.toLowerCase())) {
      return { ok: false, reason: `query contains a forbidden construct: ${bad}` };
    }
  }

  // Any identifier immediately followed by "(" is a function call. Only the
  // five plain aggregate/scalar functions in ALLOWED_FUNCTIONS may appear —
  // this is what actually stops pg_sleep(...)/dblink(...)/etc rather than
  // relying solely on FORBIDDEN_SUBSTRINGS naming every dangerous function
  // in advance.
  const functionCalls = [...sql.matchAll(/\b([a-z_][a-z0-9_]*)\s*\(/gi)].map((m) =>
    m[1].toLowerCase()
  );
  for (const fn of functionCalls) {
    if (!ALLOWED_FUNCTIONS.has(fn)) {
      return { ok: false, reason: `function not permitted: ${fn}` };
    }
  }

  // Table allowlist: every identifier following FROM/JOIN must be one of
  // the three whitelisted views. This is what stops PII exfiltration if
  // every other check somehow passed.
  const tableRefs = [...sql.matchAll(/\b(?:from|join)\s+"?([a-z_][a-z0-9_]*)"?/gi)].map(
    (m) => m[1].toLowerCase()
  );
  if (tableRefs.length === 0) {
    return { ok: false, reason: "no FROM clause found" };
  }
  for (const ref of tableRefs) {
    if (!WHITELISTED_VIEWS.includes(ref as (typeof WHITELISTED_VIEWS)[number])) {
      return { ok: false, reason: `relation not permitted: ${ref}` };
    }
  }

  // Enforce a LIMIT. Add the default if missing; reject if it's too high.
  const limitMatch = sql.match(/\blimit\s+(\d+)\b/i);
  if (limitMatch) {
    const n = parseInt(limitMatch[1], 10);
    if (n > MAX_LIMIT) {
      return { ok: false, reason: `LIMIT too high (max ${MAX_LIMIT})` };
    }
  } else {
    sql = `${sql} limit ${DEFAULT_LIMIT}`;
  }

  return { ok: true, sql };
}
