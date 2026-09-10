-- Additive migration (see 001_production.sql for the pattern this follows).
-- Adds: password reset tokens, lead/batch/invoice edit support, and
-- refunds. Does not modify or replace anything in 001_production.sql,
-- which is already applied to production.

create table if not exists password_reset (
  token_hash text primary key,
  user_id    uuid not null references app_user(id),
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists password_reset_expiry on password_reset(expires_at);

alter type event_type add value if not exists 'password.reset_requested';
alter type event_type add value if not exists 'lead.updated';
alter type event_type add value if not exists 'batch.details_updated';
alter type event_type add value if not exists 'payment.refunded';

-- continuum_staff already has update on enquiry/batch/invoice (granted in
-- 001_production.sql's blanket "select,insert,update on party,app_user,
-- enquiry,activity,course,batch,enrollment,attendance,quotation,invoice,
-- invoice_line,payment,expense,trainer_payment,operation_request" grant),
-- so no new grants are needed for edit/refund -- the existing RLS write
-- policies (invoice_write, enrollment_write, etc.) already cover updates
-- to these tables for the roles that should have them.

-- request_bucket already exists (001_production.sql) and is reused for
-- password-reset rate limiting, same as login.
