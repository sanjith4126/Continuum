-- ============================================================================
-- Continuum — event-sourced schema for a training-business platform
-- PostgreSQL 15+.  Run:  psql "$DATABASE_URL" -f schema.sql
--
-- Design in one line: the batch is the profit centre. Every rupee of revenue
-- (invoice_line) and every rupee of cost (expense, trainer_payment) carries a
-- batch_id, so per-batch net profit is a GROUP BY — not a month-end reconcile.
-- ledger_event is an append-only record of every change: audit + as-of reads.
-- ============================================================================

-- 0. Extensions ---------------------------------------------------------------
create extension if not exists pgcrypto;        -- gen_random_uuid()
-- create extension if not exists vector;       -- pgvector: enable in Neon/Supabase
                                                --   for semantic lead dedup (see party.embedding)

-- 1. Enums --------------------------------------------------------------------
create type user_role       as enum ('sales','ops','finance','trainer','management','student');
create type lead_stage      as enum ('new','contacted','qualified','quoted','won','lost');
create type batch_status    as enum ('planned','running','completed','cancelled');
create type invoice_status  as enum ('draft','issued','part_paid','paid','void');
create type expense_category as enum ('trainer_fee','venue','travel','materials','marketing','other');
create type event_type      as enum (
  'lead.created','lead.contacted','lead.converted','lead.lost',
  'quotation.sent','agreement.signed',
  'batch.created','enrollment.created','attendance.marked',
  'invoice.raised','invoice.line_added','payment.received',
  'expense.recorded','trainer_payment.recorded',
  -- delivery outcomes arriving from an integrated LMS / Zoom (we are NOT an LMS):
  'lms.completion','lms.attendance');

-- 2. Party — one row per person OR organisation, roles via array --------------
create table party (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('person','org')),
  name       text not null,
  email      text,
  phone      text,
  roles      text[] not null default '{}',   -- {student} | {corporate_buyer} | {trainer} | {referrer}
  -- embedding vector(1536),                  -- pgvector: fills to dedup "Acme Corp" vs "Acme Corp Pvt Ltd"
  created_at timestamptz not null default now()
);
create index party_name_idx  on party (lower(name));
create index party_email_idx on party (email);

-- app users for auth + RLS (staff logins and student logins)
create table app_user (
  id         uuid primary key default gen_random_uuid(),
  party_id   uuid references party(id),
  email      text unique not null,
  role       user_role not null,
  created_at timestamptz not null default now()
);

-- 3. CRM — enquiry/lead + activity --------------------------------------------
create table enquiry (
  id          uuid primary key default gen_random_uuid(),
  party_id    uuid not null references party(id),
  source      text,                             -- 'linkedin','referral','website'
  source_cost numeric(12,2) not null default 0, -- marketing spend attributed to this lead
  stage       lead_stage not null default 'new',
  owner_id    uuid references app_user(id),
  created_at  timestamptz not null default now()
);

create table activity (
  id          uuid primary key default gen_random_uuid(),
  enquiry_id  uuid references enquiry(id),
  party_id    uuid references party(id),
  kind        text not null,                    -- 'call','email','note','meeting'
  note        text,
  owner_id    uuid references app_user(id),
  occurred_at timestamptz not null default now()
);

-- 4. Training ops — course, batch (profit centre), enrollment, attendance -----
create table course (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  default_price numeric(12,2)
);

create table batch (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references course(id),
  trainer_id     uuid references party(id),        -- the trainer is a party
  source_lead_id uuid references enquiry(id),       -- traceability back to the enquiry
  name           text not null,
  location       text,
  starts_on      date,
  ends_on        date,
  status         batch_status not null default 'planned',
  created_at     timestamptz not null default now()
);
create index batch_course_idx  on batch (course_id);
create index batch_trainer_idx on batch (trainer_id);

create table enrollment (
  id          uuid primary key default gen_random_uuid(),
  batch_id    uuid not null references batch(id),
  student_id  uuid not null references party(id),
  enrolled_at timestamptz not null default now(),
  status      text not null default 'active',      -- active | completed | dropped
  unique (batch_id, student_id)
);
create index enrollment_batch_idx on enrollment (batch_id);

create table attendance (
  id           uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollment(id),
  session_date date not null,
  present      boolean not null default false
);

-- 5. Sales + money IN ---------------------------------------------------------
create table quotation (
  id         uuid primary key default gen_random_uuid(),
  enquiry_id uuid references enquiry(id),
  party_id   uuid not null references party(id),
  amount     numeric(12,2) not null,
  status     text not null default 'sent',         -- sent | accepted | rejected
  created_at timestamptz not null default now()
);

create table invoice (
  id         uuid primary key default gen_random_uuid(),
  party_id   uuid not null references party(id),
  batch_id   uuid references batch(id),
  status     invoice_status not null default 'issued',
  gst_rate   numeric(5,2) not null default 18,
  issued_at  timestamptz not null default now()
);
create index invoice_party_idx on invoice (party_id);

create table invoice_line (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoice(id),
  batch_id    uuid not null references batch(id),   -- ★ revenue side of per-batch margin
  description text,
  amount      numeric(12,2) not null,               -- pre-tax line amount
  discount    numeric(12,2) not null default 0,
  occurred_at timestamptz not null default now()    -- effective date → powers as-of reads
);
create index invoice_line_batch_idx on invoice_line (batch_id);

create table payment (
  id         uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoice(id),
  amount     numeric(12,2) not null,
  method     text,                                  -- 'bank' | 'card' | 'upi'
  due_on     date,                                  -- installment due date (for aging)
  paid_at    timestamptz                            -- null = still outstanding
);
create index payment_invoice_idx on payment (invoice_id);

-- 6. Money OUT — both carry batch_id ------------------------------------------
create table expense (
  id          uuid primary key default gen_random_uuid(),
  batch_id    uuid references batch(id),            -- ★ cost side of per-batch margin
  category    expense_category not null,
  vendor      text,
  amount      numeric(12,2) not null,
  occurred_at timestamptz not null default now()
);
create index expense_batch_idx on expense (batch_id);

create table trainer_payment (
  id          uuid primary key default gen_random_uuid(),
  batch_id    uuid not null references batch(id),   -- ★
  trainer_id  uuid not null references party(id),
  amount      numeric(12,2) not null,
  occurred_at timestamptz not null default now()
);
create index trainer_payment_batch_idx on trainer_payment (batch_id);

-- 7. The ledger — append-only source of truth (audit + as-of) -----------------
create table ledger_event (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id    uuid references app_user(id),
  event_type  event_type not null,
  entity_type text not null,                        -- 'enquiry' | 'batch' | 'invoice' ...
  entity_id   uuid,
  batch_id    uuid,                                  -- money events carry it → as-of P&L
  -- deliberately NOT a foreign key to batch(id): this is an immutable audit
  -- log (see the append-only rules below) and must be able to outlive the
  -- mutable row it describes. A batch can be deleted (e.g. test data
  -- cleanup) without breaking or blocking on its historical ledger entries;
  -- an orphaned batch_id here simply means "this event was about a batch
  -- that no longer exists," which is exactly what an audit trail should
  -- preserve, not prevent.
  amount      numeric(12,2),                        -- signed: +revenue, -cost
  payload     jsonb not null default '{}'
);
create index ledger_batch_idx  on ledger_event (batch_id);
create index ledger_time_idx   on ledger_event (occurred_at);
create index ledger_entity_idx on ledger_event (entity_type, entity_id);

-- immutability: the log is append-only
create rule ledger_no_update as on update to ledger_event do instead nothing;
create rule ledger_no_delete as on delete to ledger_event do instead nothing;

-- 8. Projections (read models the UI and AI read) -----------------------------

-- current per-batch P&L
create view batch_pnl as
select b.id as batch_id, b.name,
       coalesce(r.revenue, 0)                          as revenue,
       coalesce(c.cost, 0)                             as cost,
       coalesce(r.revenue, 0) - coalesce(c.cost, 0)    as net_profit
from batch b
left join (
  select batch_id, sum(amount - discount) as revenue
  from invoice_line group by batch_id
) r on r.batch_id = b.id
left join (
  select batch_id, sum(amount) as cost
  from (
    select batch_id, amount from expense where batch_id is not null
    union all
    select batch_id, amount from trainer_payment
  ) costs group by batch_id
) c on c.batch_id = b.id;

-- as-of P&L: reconstruct from each money row's effective date.
-- No SQL:2011 system-versioning (Postgres has none) — the effective dates are the truth.
create or replace function batch_pnl_asof(as_of timestamptz)
returns table (batch_id uuid, name text, revenue numeric, cost numeric, net_profit numeric)
language sql stable as $$
  select b.id, b.name,
         coalesce(r.rev, 0),
         coalesce(c.cost, 0),
         coalesce(r.rev, 0) - coalesce(c.cost, 0)
  from batch b
  left join (
    select batch_id, sum(amount - discount) as rev
    from invoice_line where occurred_at <= as_of group by batch_id
  ) r on r.batch_id = b.id
  left join (
    select batch_id, sum(amount) as cost from (
      select batch_id, amount, occurred_at from expense where batch_id is not null
      union all
      select batch_id, amount, occurred_at from trainer_payment
    ) costs where occurred_at <= as_of group by batch_id
  ) c on c.batch_id = b.id;
$$;

-- collections aging — outstanding installments ranked by rupees at risk
create view collections_aging as
select p.id as payment_id, i.party_id, i.batch_id, p.amount,
       p.due_on, (current_date - p.due_on) as days_overdue,
       p.amount * greatest(current_date - p.due_on, 0) as rupees_at_risk
from payment p
join invoice i on i.id = p.invoice_id
where p.paid_at is null and p.due_on is not null
order by rupees_at_risk desc;

-- top-line dashboard KPIs
create view dashboard_kpis as
select
  (select coalesce(sum(amount - discount), 0) from invoice_line)                 as revenue,
  (select coalesce(sum(amount), 0) from payment where paid_at is not null)       as collected,
  (select coalesce(sum(amount), 0) from payment where paid_at is null)           as outstanding,
  (select coalesce(sum(amount), 0) from expense)
    + (select coalesce(sum(amount), 0) from trainer_payment)                     as total_cost,
  (select coalesce(sum(net_profit), 0) from batch_pnl)                           as net_profit;

-- 9. Traceability — the enquiry-to-outcome walk for one lead ------------------
create or replace function lead_to_outcome(p_lead uuid)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'lead',     (select to_jsonb(e) from enquiry e where e.id = p_lead),
    'batches',  (select coalesce(jsonb_agg(to_jsonb(b)), '[]')
                 from batch b where b.source_lead_id = p_lead),
    'invoices', (select coalesce(jsonb_agg(to_jsonb(i)), '[]')
                 from invoice i
                 where i.party_id = (select party_id from enquiry where id = p_lead)),
    'pnl',      (select coalesce(jsonb_agg(to_jsonb(pl)), '[]')
                 from batch_pnl pl
                 where pl.batch_id in (select id from batch where source_lead_id = p_lead)),
    'events',   (select coalesce(jsonb_agg(to_jsonb(le) order by le.occurred_at), '[]')
                 from ledger_event le
                 where le.batch_id in (select id from batch where source_lead_id = p_lead))
  );
$$;

-- 10. Row-level security (pragmatic demo policies) ----------------------------
-- The app sets two settings per request/transaction, e.g.:
--   set local app.user_role = 'finance';
--   set local app.party_id  = '<the signed-in party uuid>';
-- Staff roles see everything; a student sees only their own rows (plus the
-- shared invoice/payment for a batch they're enrolled in — see
-- invoice_access below). These policies only bind a connection that does
-- NOT have rolbypassrls (table owners bypass RLS by default — see the
-- continuum_app note near the bottom of this section for why that matters).
-- The student assistant runs as continuum_app; the AI data consultant runs
-- as continuum_ai (read-only views only, no base-table access at all).

alter table enrollment  enable row level security;
alter table attendance  enable row level security;
alter table invoice     enable row level security;
alter table payment     enable row level security;
alter table invoice_line enable row level security;

create policy enrollment_access on enrollment for select using (
  current_setting('app.user_role', true) <> 'student'
  or student_id = nullif(current_setting('app.party_id', true), '')::uuid
);

create policy attendance_access on attendance for select using (
  current_setting('app.user_role', true) <> 'student'
  or enrollment_id in (
    select id from enrollment
    where student_id = nullif(current_setting('app.party_id', true), '')::uuid
  )
);

-- invoice_access has two student-visibility branches: party_id (the
-- student is themself the billed party — rare, but kept for that case) and
-- batch_id via their own enrollment (the common case: a corporate buyer is
-- billed, e.g. Acme, but every student enrolled in that batch can see the
-- programme's invoice as shared billing context — not personal debt, see
-- the student assistant's UI copy). The enrollment branch joins strictly
-- through enrollment.batch_id keyed to the caller's own party_id — it does
-- not widen access to other batches from the same paying org.
create policy invoice_access on invoice for select using (
  current_setting('app.user_role', true) in ('finance','management','sales','ops')
  or party_id = nullif(current_setting('app.party_id', true), '')::uuid
  or batch_id in (
    select batch_id from enrollment
    where student_id = nullif(current_setting('app.party_id', true), '')::uuid
  )
);

-- payment_access mirrors invoice_access's two branches through the invoice
-- it belongs to (payment has no batch_id of its own).
create policy payment_access on payment for select using (
  current_setting('app.user_role', true) in ('finance','management','sales','ops')
  or invoice_id in (
    select id from invoice
    where party_id = nullif(current_setting('app.party_id', true), '')::uuid
       or batch_id in (
         select batch_id from enrollment
         where student_id = nullif(current_setting('app.party_id', true), '')::uuid
       )
  )
);

-- invoice_line has its own batch_id column, so its policy checks enrollment
-- directly rather than indirecting through invoice. NOTE: this policy is
-- not optional decoration — invoice_line was briefly GRANTed to
-- continuum_app without RLS enabled on the table at all, on the mistaken
-- assumption that "application code only ever joins through invoice first"
-- made a bare grant safe. It does not: a GRANT has no way to know how a
-- query intends to join, and scripts/setup-app-role.js's live check 2b
-- caught this table leaking another student's invoice line before this
-- policy existed. RLS on the table itself is what actually enforces it.
create policy invoice_line_access on invoice_line for select using (
  current_setting('app.user_role', true) in ('finance','management','sales','ops')
  or batch_id in (
    select batch_id from enrollment
    where student_id = nullif(current_setting('app.party_id', true), '')::uuid
  )
);

-- AI read-only role (create once at the DB level, then use it for the agent):
--   create role continuum_ai nologin;
--   grant usage on schema public to continuum_ai;
--   grant select on batch_pnl, collections_aging, dashboard_kpis to continuum_ai;
--   -- deliberately NO grant on base tables → the agent only sees safe views.

-- Student-assistant role. IMPORTANT: neondb_owner (the role migrations and
-- the app connect as, on Neon) owns these tables and therefore has
-- rolbypassrls = true by default — RLS is silently a no-op for that
-- connection regardless of app.user_role/app.party_id. Any code path that
-- needs RLS to actually apply (the student assistant) MUST run as a role
-- with rolbypassrls = false, granted only the tables it needs:
--   create role continuum_app nologin nobypassrls;
--   grant usage on schema public to continuum_app;
--   grant select on enrollment, attendance, invoice, payment, invoice_line,
--     batch, course to continuum_app;
--   -- deliberately no grant on party, ledger_event, or any money-out table.
--   -- every granted table with student-identifying rows (enrollment,
--   -- attendance, invoice, payment, invoice_line) has its own RLS policy
--   -- above — the grant alone is never sufficient, see invoice_line_access.
--   grant continuum_app to neondb_owner;  -- lets the app SET LOCAL ROLE
-- Empirically verified (not just declared) in scripts/setup-app-role.js.
