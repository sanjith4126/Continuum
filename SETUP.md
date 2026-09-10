# Continuum — setup, from an empty folder to your first screen

Follow top to bottom. Commands assume a Unix-style shell (macOS Terminal, Linux,
or on Windows use **Git Bash** or **WSL**). Anywhere you see `CONNECTION_STRING`,
paste your real Neon string.

---

## 0. Prerequisites (5 min)
You need three things installed:
- **Node.js 20 LTS** — check with `node -v` (must be ≥ 18.18). Get it from nodejs.org.
- **VS Code** with the **Claude Code** extension (and Codex, which you already have).
- A **web browser** (for the Neon database — no local database install needed).

---

## 1. Create the project folder and add the kit (2 min)
```bash
mkdir continuum
cd continuum
mkdir db
```
Move the four files you downloaded into place:
- `CLAUDE.md`      → `continuum/CLAUDE.md`
- `BUILD_PLAN.md`  → `continuum/BUILD_PLAN.md`
- `SETUP.md`       → `continuum/SETUP.md`  (this file)
- `schema.sql`     → `continuum/db/schema.sql`
- `seed.sql`       → `continuum/db/seed.sql`

Start version control (optional but do it):
```bash
git init
printf "node_modules/\n.env*\n.next/\n" > .gitignore
```

Your folder should now look like:
```
continuum/
├─ CLAUDE.md
├─ BUILD_PLAN.md
├─ SETUP.md
└─ db/
   ├─ schema.sql
   └─ seed.sql
```

---

## 2. Get a free Postgres database (5 min)
1. Go to **neon.tech** and sign up (free tier is plenty).
2. Create a new **Project** (any name, e.g. `continuum`; pick a region near you).
3. On the project dashboard, find the **connection string**. It looks like:
   `postgresql://user:password@ep-xxxx.region.aws.neon.tech/dbname?sslmode=require`
4. Copy it — that's your `CONNECTION_STRING`.

---

## 3. Load the schema and seed (5 min)
**Easiest way (no install): Neon's SQL Editor in the browser.**
1. In your Neon project, open the **SQL Editor**.
2. Open `db/schema.sql`, copy **all** of it, paste into the editor, click **Run**.
   You should see it succeed (creates tables, views, functions, policies).
3. Now open `db/seed.sql`, copy all, paste, **Run**. That loads the demo data.

*(Alternative, if you have `psql` installed):*
```bash
psql "CONNECTION_STRING" -f db/schema.sql
psql "CONNECTION_STRING" -f db/seed.sql
```

---

## 4. Verify the spine works (1 min) — this is the important moment
In the Neon SQL Editor, run:
```sql
select * from batch_pnl order by net_profit;
```
You should see two rows:
- **TCS — DevOps Bootcamp** → net_profit **-70000**  (a loss, shows red later)
- **Acme — Advanced Python** → net_profit **+140000** (a profit, shows green)

Also try the time-travel and traceability functions:
```sql
select * from batch_pnl_asof(now() - interval '7 days');   -- P&L as of last week
select lead_to_outcome('00000000-0000-0000-0000-0000000000e1');  -- the Acme chain
select * from collections_aging;                            -- the ₹2.0L outstanding
```
If these return data, **your entire data story is already live** — per-batch profit,
as-of reporting, traceability, and collections are all working in the database. The
app is now just a nice face on top.

---

## 5. Scaffold the web app (5 min)
From the `continuum/` folder:
```bash
npx create-next-app@latest web
```
Answer the prompts: **TypeScript → Yes**, **App Router → Yes**, **Tailwind → Yes**,
**ESLint → Yes**, `src/` dir and import alias → defaults are fine.

Then give the app the database connection:
```bash
cd web
printf 'DATABASE_URL="CONNECTION_STRING"\n' > .env.local
cd ..
```
(Replace `CONNECTION_STRING` with your real Neon string. `.env.local` is git-ignored.)

---

## 6. Open in VS Code and hand off to Claude Code (2 min)
```bash
code .
```
In VS Code, open the **Claude Code** panel. It automatically reads `CLAUDE.md`, so
it already knows the architecture, scope, and conventions.

Open **`AUTORUN.md`**, copy its entire contents, and paste it into Claude Code as
one message. This gives it permission to run the whole build autonomously —
schema, seed, scaffolding, and every phase in `BUILD_PLAN.md` — without stopping
to ask after each step. It will pause once, after Phase 4, to show you what it
built and check in before starting the AI stretch phases (those need an
Anthropic API key and are worth a deliberate yes).

That's the automation: one prompt, most of the build. You still watch the terminal
and answer the one question it can't answer itself — your database connection
string, if it isn't already in `.env`.

---

## 7. If you'd rather drive phase-by-phase yourself
Skip `AUTORUN.md` and instead open `BUILD_PLAN.md`, pasting each phase's kickoff
prompt into Claude Code one at a time, reviewing before moving on. Same content,
more control, less hands-off.

**Split of tools:** let **Claude Code** drive the build (it uses `CLAUDE.md` as
context); use **Codex** for a second pass — writing tests for the Phase 3 lifecycle
actions and reviewing the read-only SQL validator in Phase 5. Don't have both edit
the same file at once.

---

## Troubleshooting
- **`node -v` shows an old version** → install Node 20 LTS from nodejs.org.
- **`psql: command not found`** → skip psql; use the Neon SQL Editor (step 3).
- **Connection errors** → make sure the string ends with `?sslmode=require` (Neon
  adds this) and you pasted the full string in quotes.
- **A staff page shows 0 for collected/outstanding** → that's row-level security. Your
  app should connect with the Neon owner role (which bypasses RLS) or set
  `app.user_role='management'` per request — Claude Code handles this per CLAUDE.md.
  RLS is meant to bite only for the student assistant, where it scopes each student
  to their own rows.
- **Want the pgvector dedup?** In Neon SQL Editor run `create extension vector;`, then
  uncomment the `embedding` lines in `schema.sql`. Optional — don't block on it.
