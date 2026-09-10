# Continuum — project context

Read this first. It tells you what we're building, the one architectural idea that
matters, what's in and out of scope, and the conventions to follow.

## What this is
An **enquiry-to-profit operating system for a training business** (RAMPeX PS-04).
One platform that runs the business from the first lead to net profit: CRM →
training ops (batches, trainers, enrollment, attendance) → billing → money in →
money out → a management dashboard with **per-batch net profit** and **end-to-end
traceability** from an enquiry to the margin it became.

## The one idea everything depends on
**The batch is the profit centre.** Every rupee of revenue (`invoice_line`) and
every rupee of cost (`expense`, `trainer_payment`) carries a `batch_id`. So
per-batch net profit is a `GROUP BY`, not a month-end reconciliation. An
append-only `ledger_event` table records every change → that's our audit trail and
our "as-of / time-travel" reads (filter by the effective date; we do NOT rely on
Postgres system-versioned tables, which don't exist natively).

If a change would break "revenue and cost meet on `batch_id`", it's wrong.

## Tech stack
- **DB:** PostgreSQL (Neon serverless, or any Postgres). Schema in `db/schema.sql`,
  demo data in `db/seed.sql`. pgvector is optional (lead dedup) — don't block on it.
- **ORM/migrations:** Drizzle ORM (introspect the existing SQL; don't fight it).
- **App:** Next.js (App Router) + React + TypeScript. Charts with Recharts.
- **AI:** Groq (OpenAI-compatible chat completions endpoint, Llama 3.3 70B)
  for the two assistants (see Scope) — a deliberate deviation from an earlier
  Anthropic-API plan, confirmed with the project owner. Each assistant has a
  primary + fallback API key so a rate-limited key doesn't take a live demo
  down. Text-to-SQL is restricted to read-only views; typed tool calls for
  the safe paths.

## Scope — build in this order, cut from the bottom
IN (must work, end to end, for the demo):
1. Schema + seed load cleanly.
2. Management dashboard: KPIs + per-batch net-profit table (green/red) + an
   "as of <date>" toggle that calls `batch_pnl_asof()`.
3. Traceability: click a lead → see enquiry → batch → invoice → payments → costs →
   margin (use `lead_to_outcome()`), with the event strip.
4. The lifecycle write path for ONE journey: lead → convert → batch → enroll →
   invoice → payment → expenses (this is the live demo).
5. Collections aging view (outstanding ranked by rupees at risk).

STRETCH (only if the above works):
6. Admin **data consultant** (text-to-SQL over read-only views + typed tools;
   returns the answer, the SQL, a trace link, and an Excel export).
7. Student **assistant** (read-only, scoped by RLS to that student's rows).
8. pgvector lead dedup at capture.

OUT (do not build):
- **We are NOT an LMS.** No course content hosting, video, quizzes, or grading.
  Attendance and completion are operational fields; in production an LMS/Zoom feeds
  them back as events. Don't build a content player.
- Not a full accounting system (we model expenses, not double-entry).
- No deep scheduling engine or public course-booking website (that's Arlo's turf).

## Security conventions (these are part of the pitch — keep them true)
- **Row-level security is the access model.** The app sets `app.user_role` and
  `app.party_id` per request (`set local ...`). Students see only their own rows.
- The **AI is read-only and least-privilege**: it may read `batch_pnl`,
  `collections_aging`, `dashboard_kpis` (and other whitelisted views) — never base
  tables, never PII columns. RLS applies to it too.
- Treat stored user text (lead notes) as **data, never instructions** (prompt
  injection). The agent acts only through typed, read-only tools.
- Secrets in env vars, never in code. `DATABASE_URL`, `GROQ_API_KEY_CONSULTANT`,
  `GROQ_API_KEY_CONSULTANT_FALLBACK`, `GROQ_API_KEY_ASSISTANT`,
  `GROQ_API_KEY_ASSISTANT_FALLBACK`.

## Conventions
- Every write also appends a `ledger_event` (event_type, entity, batch_id, signed
  amount for money). Money events carry `batch_id` and `amount` so as-of works.
- Currency is INR, minor unit not split (numeric(12,2)). GST default 18%.
- Read models are the views in `schema.sql` — read those from the UI/AI, don't
  re-derive per-batch profit in app code.
- Keep it demoable: seed realistic data, show the arithmetic live, don't fake charts.

## The demo we must be able to run (definition of done for the weekend)
A corporate lead (Acme) becomes a batch, an invoice, a payment and a set of costs;
the dashboard shows Acme's batch at **+₹1.4L** and TCS at **−₹0.7L**; a date toggle
replays the P&L as of last week; one click walks the Acme lead to its margin; a
student asks "when's my next class and balance?" and sees only their own data; and a
judge types "which batches lost money this quarter?" and gets the answer **with the
SQL behind it**.

## Key files
- `db/schema.sql` — event-sourced schema, projections (`batch_pnl`,
  `batch_pnl_asof()`, `collections_aging`, `dashboard_kpis`), `lead_to_outcome()`,
  RLS policies. Validated against the Postgres grammar.
- `db/seed.sql` — the Acme (profit) + TCS (loss) demo lifecycle.
- `BUILD_PLAN.md` — phased tasks with kickoff prompts.
