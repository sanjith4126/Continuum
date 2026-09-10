-- Additive production-hardening migration.
-- Adds concurrency protection and database-level validation without changing
-- valid business data. Constraint names are checked so this file is rerunnable.

create unique index if not exists attendance_enrollment_session_key
  on attendance(enrollment_id, session_date);

create unique index if not exists app_user_email_ci_key
  on app_user(lower(email));

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='party'::regclass and conname='party_name_valid') then
    alter table party add constraint party_name_valid check (btrim(name) <> '' and length(name) <= 200);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='party'::regclass and conname='party_contact_lengths_valid') then
    alter table party add constraint party_contact_lengths_valid check ((email is null or length(email) <= 254) and (phone is null or length(phone) <= 50));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='app_user'::regclass and conname='app_user_email_valid') then
    alter table app_user add constraint app_user_email_valid check (btrim(email) <> '' and length(email) <= 254);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='enquiry'::regclass and conname='enquiry_input_valid') then
    alter table enquiry add constraint enquiry_input_valid check (source_cost >= 0 and (source is null or length(source) <= 100));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='activity'::regclass and conname='activity_input_valid') then
    alter table activity add constraint activity_input_valid check (kind in ('agreement','call','email','note','meeting') and (note is null or length(note) <= 4000));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='course'::regclass and conname='course_input_valid') then
    alter table course add constraint course_input_valid check (btrim(title) <> '' and length(title) <= 200 and (default_price is null or default_price > 0));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='batch'::regclass and conname='batch_input_valid') then
    alter table batch add constraint batch_input_valid check (btrim(name) <> '' and length(name) <= 200 and (location is null or length(location) <= 200) and (ends_on is null or starts_on is null or ends_on >= starts_on));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='enrollment'::regclass and conname='enrollment_status_valid') then
    alter table enrollment add constraint enrollment_status_valid check (status in ('active','completed','dropped'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='quotation'::regclass and conname='quotation_input_valid') then
    alter table quotation add constraint quotation_input_valid check (amount > 0 and status in ('sent','accepted','rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='invoice'::regclass and conname='invoice_gst_valid') then
    alter table invoice add constraint invoice_gst_valid check (gst_rate >= 0 and gst_rate <= 100);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='invoice_line'::regclass and conname='invoice_line_input_valid') then
    alter table invoice_line add constraint invoice_line_input_valid check (amount > 0 and discount >= 0 and discount <= amount and (description is null or length(description) <= 500));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='payment'::regclass and conname='payment_input_valid') then
    alter table payment add constraint payment_input_valid check (
      (amount > 0 and (method is null or method in ('bank','upi','card','cash')))
      or (amount < 0 and method = 'refund' and paid_at is not null)
    );
  end if;
  if not exists (select 1 from pg_constraint where conrelid='expense'::regclass and conname='expense_input_valid') then
    alter table expense add constraint expense_input_valid check (amount > 0 and (vendor is null or length(vendor) <= 200));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='trainer_payment'::regclass and conname='trainer_payment_amount_valid') then
    alter table trainer_payment add constraint trainer_payment_amount_valid check (amount > 0);
  end if;
end $$;
