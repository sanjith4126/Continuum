# AUTORUN — paste this whole file into Claude Code, once

You have full autonomy to build this end to end without stopping to ask for
confirmation between steps. Work through the phases below in order. Only stop and
ask the user if: (a) `DATABASE_URL` is missing or the database connection fails and
you cannot proceed, or (b) you hit a genuine ambiguity that changes the data model
described in `CLAUDE.md`. Otherwise, keep going autonomously, phase to phase,
committing to git after each phase completes and passes its own check.

First: **read `CLAUDE.md` in full**, then `BUILD_PLAN.md` in full. They are the
spec. Do not deviate from the schema in `db/schema.sql` — introspect it, don't
recreate it.

## Phase 0 — environment + schema load
1. Check `node -v` is ≥ 18.18. If not, tell the user to install Node 20 LTS and stop.
2. Check a `.env` or `.env.local` exists somewhere in the repo with `DATABASE_URL`
   set. If it does not exist anywhere, **stop and ask the user for their Neon
   connection string** — this is the one thing you cannot get yourself.
3. Once you have `DATABASE_URL`, load the schema and seed:
   ```
   psql "$DATABASE_URL" -f db/schema.sql
   psql "$DATABASE_URL" -f db/seed.sql
   ```
   If `psql` isn't installed, write and run a small Node script using the `pg`
   package to execute both files against `DATABASE_URL` instead — don't block on
   tooling.
4. Verify: query `select * from batch_pnl order by net_profit;` and confirm you get
   TCS at -70000 and Acme at +140000. Print this result so the user can see it
   worked.
5. Scaffold the app: `npx create-next-app@latest web --ts --app --tailwind --eslint
   --src-dir --import-alias "@/*" --use-npm --yes`.
6. Put `DATABASE_URL` into `web/.env.local`.
7. Set up Drizzle ORM in `web/`: install `drizzle-orm`, `drizzle-kit`, and `pg`;
   introspect the live database (`drizzle-kit introspect`) rather than hand-writing
   the schema, so the generated types match `db/schema.sql` exactly.
8. Add a `web/src/app/health/route.ts` that runs `select 1` and returns `{ok:true}`.
9. Run `npm run dev` in `web/`, confirm `/health` responds, then stop the dev server.
10. `git add -A && git commit -m "Phase 0: schema loaded, Next.js + Drizzle scaffolded"`.

## Phase 1 — dashboard
Build `/dashboard`: 4 KPI cards from `dashboard_kpis`, a per-batch net-profit table
from `batch_pnl` (green bar for profit, red for loss, matching the pitch deck's
mockup style — clean, macOS-like, lots of white space), and an "As of" date picker
that re-queries `batch_pnl_asof(date)`. Verify by loading the page and confirming
Acme shows green and TCS shows red with the correct numbers. Commit.

## Phase 2 — traceability
Build `/trace/[leadId]` calling `lead_to_outcome(uuid)`, rendering the chain
(Enquiry → Batch → Invoice → Payments → Expenses → Net margin) plus the event list.
Link to it from each batch row on the dashboard. Verify with the seeded lead id
`00000000-0000-0000-0000-0000000000e1`. Commit.

## Phase 3 — lifecycle write path
Implement server actions: createLead, convertLead, createBatch, enrollStudent,
raiseInvoice, recordPayment, recordExpense, recordTrainerPayment. Each writes its
row AND appends a matching `ledger_event` in the same transaction (batch_id +
signed amount for money events). Build a minimal `/pipeline` page to trigger them
in sequence for a demo. Verify by running through the whole lifecycle for a new
test lead and confirming a new row appears in `batch_pnl`. Commit.

## Phase 4 — collections aging
Build `/collections` from the `collections_aging` view, sorted by rupees at risk.
Verify the seeded outstanding installment appears. Commit.

## Checkpoint — report back
After Phase 4, stop and summarize: what's built, what's running, any deviations
from the plan, and how much time/scope remains for Phases 5–6 (AI consultant,
student assistant). Wait for the user before starting stretch phases, since those
involve API keys and cost tradeoffs the user should confirm.

## Phase 5 — AI data consultant (only after user confirms)
Follow `BUILD_PLAN.md` Phase 5 exactly: read-only `continuum_ai` role, whitelist of
views only, validate generated SQL is a single SELECT before executing, render
answer + SQL + trace link + Excel export. Requires `ANTHROPIC_API_KEY` — ask the
user for it if not already in `.env`.

## Phase 6 — student assistant (only after user confirms)
Follow `BUILD_PLAN.md` Phase 6: RLS-scoped via `app.user_role`/`app.party_id`,
typed read-only queries only, no free-form SQL.

## Throughout
- Never build LMS-style features (content hosting, video, quizzes, grading) — see
  the Scope section in `CLAUDE.md`.
- Keep every write paired with a `ledger_event`.
- If a step fails, retry once with a fix; if it fails twice, log what you tried and
  move to the next independent task rather than stalling the whole run.
