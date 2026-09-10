-- Additive migration. Existing business tables/data are preserved.
create table if not exists auth_credential (
 user_id uuid primary key references app_user(id), password_hash text not null,
 disabled boolean not null default false, must_change boolean not null default true
);
create table if not exists auth_session (
 token_hash text primary key, user_id uuid not null references app_user(id),
 expires_at timestamptz not null, created_at timestamptz not null default now()
);
create index if not exists auth_session_expiry on auth_session(expires_at);
create table if not exists request_bucket (
 key text primary key, hits integer not null, expires_at timestamptz not null
);
create table if not exists operation_request (
 user_id uuid not null references app_user(id), request_id uuid not null,
 result jsonb not null, primary key(user_id,request_id)
);
alter type event_type add value if not exists 'party.created';
alter type event_type add value if not exists 'course.created';
alter type event_type add value if not exists 'batch.updated';
alter type event_type add value if not exists 'payment.scheduled';
alter type event_type add value if not exists 'payment.settled';
alter type event_type add value if not exists 'account.created';
alter type event_type add value if not exists 'account.updated';
alter type event_type add value if not exists 'password.changed';

do $$ begin
 if not exists(select 1 from pg_roles where rolname='continuum_staff') then
  create role continuum_staff nologin nobypassrls;
 end if;
end $$;
alter role continuum_staff nobypassrls;
grant usage on schema public to continuum_staff;
grant select,insert,update on party,app_user,enquiry,activity,course,batch,enrollment,attendance,
 quotation,invoice,invoice_line,payment,expense,trainer_payment,operation_request to continuum_staff;
grant select,insert on ledger_event to continuum_staff;
grant usage,select on all sequences in schema public to continuum_staff;
grant select on batch_pnl,collections_aging,dashboard_kpis to continuum_staff;
do $$ begin execute format('grant continuum_staff to %I',current_user); end $$;

drop policy if exists enrollment_access on enrollment;
create policy enrollment_access on enrollment for select using (
 current_setting('app.user_role',true) in ('management','sales','ops','finance')
 or (current_setting('app.user_role',true)='student' and student_id=nullif(current_setting('app.party_id',true),'')::uuid)
 or (current_setting('app.user_role',true)='trainer' and batch_id in
   (select id from batch where trainer_id=nullif(current_setting('app.party_id',true),'')::uuid))
);
-- SECURITY: the original version of this policy (before this fix) read
-- `or enrollment_id in (select id from enrollment)` with NO student_id
-- filter -- meaning any authenticated student could read every OTHER
-- student's attendance record, not just their own. That version was live
-- in production and has been corrected here; see git history / the review
-- that caught it for details. Do not remove the student_id/trainer_id
-- predicates below.
drop policy if exists attendance_access on attendance;
create policy attendance_access on attendance for select using (
 current_setting('app.user_role',true) in ('management','sales','ops','finance')
 or (current_setting('app.user_role',true)='student' and enrollment_id in
   (select id from enrollment where student_id=nullif(current_setting('app.party_id',true),'')::uuid))
 or (current_setting('app.user_role',true)='trainer' and enrollment_id in
   (select e.id from enrollment e join batch b on b.id=e.batch_id
    where b.trainer_id=nullif(current_setting('app.party_id',true),'')::uuid))
);
drop policy if exists enrollment_write on enrollment;
create policy enrollment_write on enrollment for all to continuum_staff
 using(current_setting('app.user_role',true) in ('management','ops'))
 with check(current_setting('app.user_role',true) in ('management','ops'));
-- SECURITY: same bug class as attendance_access above -- the original
-- trainer clause here was `enrollment_id in (select id from enrollment)`
-- with no trainer_id filter, so ANY trainer could write/mark attendance
-- for ANY student in ANY batch, not just batches they're assigned to.
-- Also live in production; corrected here.
drop policy if exists attendance_write on attendance;
create policy attendance_write on attendance for all to continuum_staff
 using(current_setting('app.user_role',true) in ('management','ops') or
 (current_setting('app.user_role',true)='trainer' and enrollment_id in
   (select e.id from enrollment e join batch b on b.id=e.batch_id
    where b.trainer_id=nullif(current_setting('app.party_id',true),'')::uuid)))
 with check(current_setting('app.user_role',true) in ('management','ops') or
 (current_setting('app.user_role',true)='trainer' and enrollment_id in
   (select e.id from enrollment e join batch b on b.id=e.batch_id
    where b.trainer_id=nullif(current_setting('app.party_id',true),'')::uuid)));
drop policy if exists invoice_write on invoice;
create policy invoice_write on invoice for all to continuum_staff
 using(current_setting('app.user_role',true) in ('management','finance'))
 with check(current_setting('app.user_role',true) in ('management','finance'));
drop policy if exists invoice_line_write on invoice_line;
create policy invoice_line_write on invoice_line for all to continuum_staff
 using(current_setting('app.user_role',true) in ('management','finance'))
 with check(current_setting('app.user_role',true) in ('management','finance'));
drop policy if exists payment_write on payment;
create policy payment_write on payment for all to continuum_staff
 using(current_setting('app.user_role',true) in ('management','finance'))
 with check(current_setting('app.user_role',true) in ('management','finance'));

create or replace function lead_to_outcome(p_lead uuid)
returns jsonb language sql stable as $$
 select jsonb_build_object(
 'lead',(select to_jsonb(e) from enquiry e where id=p_lead),
 'batches',(select coalesce(jsonb_agg(to_jsonb(b)),'[]') from batch b where source_lead_id=p_lead),
 'invoices',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from invoice i where batch_id in(select id from batch where source_lead_id=p_lead)),
 'pnl',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from batch_pnl p where batch_id in(select id from batch where source_lead_id=p_lead)),
 'events',(select coalesce(jsonb_agg(to_jsonb(e) order by occurred_at,id),'[]') from ledger_event e
 where batch_id in(select id from batch where source_lead_id=p_lead) or (entity_type='enquiry' and entity_id=p_lead)));
$$;
