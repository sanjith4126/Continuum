# Continuum — build plan

Phased so a complete thin line is always working. Cut from the bottom if time runs
short. Each phase has a **kickoff prompt** you can paste into Claude Code / Codex.

## Phase 0 — setup (30 min)
- Create a Neon (or local) Postgres, put the connection string in `.env` as
  `DATABASE_URL`.
- `psql "$DATABASE_URL" -f db/schema.sql && psql "$DATABASE_URL" -f db/seed.sql`
- Sanity: `select * from batch_pnl order by net_profit;` → Acme +140000, TCS −70000.
- Scaffold the app: `npx create-next-app@latest web --ts --app --tailwind`.

> **Kickoff prompt:** "Read CLAUDE.md. Set up a Next.js (App Router, TypeScript,
> Tailwind) app in `web/`. Add Drizzle ORM and introspect the existing Postgres at
> `DATABASE_URL` (schema is in `db/schema.sql` — do not recreate it, just generate
> types/queries from it). Add a `/health` route that runs `select 1` and returns ok."

## Phase 1 — the dashboard (the money shot)
- Server route reads `dashboard_kpis` and `batch_pnl`.
- Page: 4 KPI cards (revenue, collected, outstanding, net profit) + a per-batch
  table with a green/red net-profit bar. Match the mockup on deck slide 9.
- Add an "As of <date>" control that calls `batch_pnl_asof($date)`.

> **Kickoff prompt:** "Build the management dashboard at `/dashboard`. Read the
> `dashboard_kpis` and `batch_pnl` views via Drizzle. Render four KPI cards and a
> 'net profit by batch' table with a green bar for profit and red for loss. Add an
> 'As of' date picker that re-queries `batch_pnl_asof(date)` and updates the table.
> Apple/macOS aesthetic: system font, lots of white space, subtle borders."

## Phase 2 — traceability (the pitch)
- Route calls `lead_to_outcome($lead_id)`; render the enquiry → batch → invoice →
  payments → costs → margin chain plus the event strip.
- From the dashboard, clicking a batch's source lead opens this view.

> **Kickoff prompt:** "Build a `/trace/[leadId]` page that calls the
> `lead_to_outcome(uuid)` SQL function and renders the returned JSON as a vertical
> chain: Enquiry → Batch → Invoice → Payments → Expenses → Net margin card, with the
> ledger_event list on the right. Link to it from each batch row on the dashboard."

## Phase 3 — the lifecycle write path (the live demo)
- Minimal forms/actions to walk ONE journey: create lead → convert → create batch →
  enroll students → raise invoice + line → record a payment → record expenses.
- **Every write also appends a `ledger_event`** (money events carry `batch_id` and a
  signed `amount`). Wrap each action in a transaction that does both.

> **Kickoff prompt:** "Implement server actions for the lifecycle: createLead,
> convertLead, createBatch, enrollStudent, raiseInvoice (with one invoice_line),
> recordPayment, recordExpense, recordTrainerPayment. Each action runs in a
> transaction that writes the row AND appends a matching `ledger_event`
> (event_type, entity_type, entity_id, batch_id, signed amount, payload). Add a
> thin `/pipeline` UI to trigger them in order for the demo."

## Phase 4 — collections aging
- Read `collections_aging`; show the outstanding queue ranked by rupees at risk.
- (Optional) a `pg_cron` job or a scheduled route to "age" nightly.

> **Kickoff prompt:** "Add a `/collections` page reading the `collections_aging`
> view, showing outstanding installments ranked by rupees_at_risk with days overdue."

## Phase 5 — the AI data consultant (STRETCH, high wow)
- A read-only DB role (`continuum_ai`) with SELECT only on the whitelisted views.
- Endpoint: NL question → Anthropic API generates SQL constrained to those views (or
  picks a typed tool: get_batch_pnl, list_outstanding, student_schedule,
  lead_to_outcome) → run it as `continuum_ai` → return answer + the SQL + a trace
  link + an Excel export (SheetJS).
- Guardrails: validate/parse the SQL is read-only before executing; cap rows; never
  expose base tables or PII. Pre-cache the two demo prompts as a fallback.

> **Kickoff prompt:** "Build `/consultant`: a chat box that sends the question to the
> Anthropic API with a system prompt describing ONLY these read-only views
> (dashboard_kpis, batch_pnl, collections_aging) and their columns, asking it to
> return a single read-only SELECT. Validate the SQL is a single SELECT against the
> whitelist (reject anything else), run it as the read-only `continuum_ai` role, and
> render: the answer table, the SQL in a code block, a 'View trace' link, and an
> 'Export to Excel' button (SheetJS). Cache answers for the two demo questions."

## Phase 6 — the student assistant (STRETCH)
- Same pattern, but the session sets `app.user_role='student'` and `app.party_id`, so
  RLS scopes every read to that student. Typed tools only: student_schedule, balance.

> **Kickoff prompt:** "Build `/assistant` for a signed-in student. Set
> `app.user_role='student'` and `app.party_id` per request so RLS applies. Answer
> 'when's my next class' and 'what's my balance' via typed read-only queries scoped
> to that student. Never allow free-form SQL here."

## Phase 7 — polish + demo hardening
- Seed looks realistic; show the arithmetic live (don't fake charts).
- Pre-test and cache the exact demo clicks and AI prompts; offline fallback.
- README with architecture diagram + the one-command setup.

## What to cut if you're behind (in order)
Student assistant → data consultant → collections cron → pgvector dedup. Never cut:
schema, dashboard with per-batch profit, traceability, the one lifecycle walk.
