-- ============================================================================
-- Continuum — demo seed.  Run AFTER schema.sql:
--   psql "$DATABASE_URL" -f seed.sql
--
-- Produces the on-stage story:
--   • Acme  batch  → revenue 4.0L, cost 2.6L, net  +1.4L   (green)
--   • TCS   batch  → revenue 3.2L, cost 3.9L, net  -0.7L   (red)
--   • one outstanding installment (2.0L) aging in the collections queue
-- Fixed UUIDs so the demo is deterministic.
-- ============================================================================

-- Parties ---------------------------------------------------------------------
insert into party (id, kind, name, email, roles) values
  ('00000000-0000-0000-0000-0000000000a1','org','Acme Corporation Pvt Ltd','ops@acme.example','{corporate_buyer}'),
  ('00000000-0000-0000-0000-0000000000a2','org','TCS Learning','learn@tcs.example','{corporate_buyer}'),
  ('00000000-0000-0000-0000-0000000000a3','person','R. Nair','nair@trainers.example','{trainer}'),
  ('00000000-0000-0000-0000-0000000000a4','person','S. Rao','rao@trainers.example','{trainer}'),
  ('00000000-0000-0000-0000-0000000000a5','person','Ananya Sharma','ananya@student.example','{student}'),
  ('00000000-0000-0000-0000-0000000000a6','person','Rahul Verma','rahul@student.example','{student}');

-- App users (a finance login and a student login) -----------------------------
insert into app_user (id, party_id, email, role) values
  ('00000000-0000-0000-0000-0000000000u1', null,                                   'finance@continuum.example','finance'),
  ('00000000-0000-0000-0000-0000000000u2','00000000-0000-0000-0000-0000000000a5','ananya@student.example',   'student');

-- Course ----------------------------------------------------------------------
insert into course (id, title, default_price) values
  ('00000000-0000-0000-0000-0000000000c1','Advanced Python', 20000);

-- Enquiry / lead (Acme, from a LinkedIn campaign that cost 4,000) --------------
insert into enquiry (id, party_id, source, source_cost, stage, owner_id, created_at) values
  ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000a1','linkedin',4000,'won',
   '00000000-0000-0000-0000-0000000000u1', now() - interval '30 days');

insert into activity (enquiry_id, party_id, kind, note, occurred_at) values
  ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000a1','call','Intro call — 20 seats for Python', now() - interval '28 days'),
  ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000a1','email','Sent proposal',                    now() - interval '25 days');

-- Batches (Acme = profit, TCS = loss) -----------------------------------------
insert into batch (id, course_id, trainer_id, source_lead_id, name, location, starts_on, ends_on, status) values
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a3',
   '00000000-0000-0000-0000-0000000000e1','Acme — Advanced Python','Bengaluru', current_date - 20, current_date - 6, 'completed'),
  ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a4',
   null,                                   'TCS — DevOps Bootcamp','Pune',       current_date - 15, current_date - 1, 'completed');

-- Enrollments + a little attendance -------------------------------------------
insert into enrollment (id, batch_id, student_id, status) values
  ('00000000-0000-0000-0000-0000000000n1','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a5','completed'),
  ('00000000-0000-0000-0000-0000000000n2','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a6','active');

insert into attendance (enrollment_id, session_date, present) values
  ('00000000-0000-0000-0000-0000000000n1', current_date - 18, true),
  ('00000000-0000-0000-0000-0000000000n1', current_date - 16, true);

-- Invoices + lines (the revenue side, tagged to the batch) --------------------
insert into invoice (id, party_id, batch_id, status, issued_at) values
  ('00000000-0000-0000-0000-0000000000i1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','part_paid', now() - interval '14 days'),
  ('00000000-0000-0000-0000-0000000000i2','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000b2','paid',      now() - interval '12 days');

insert into invoice_line (invoice_id, batch_id, description, amount, occurred_at) values
  ('00000000-0000-0000-0000-0000000000i1','00000000-0000-0000-0000-0000000000b1','20 seats × Advanced Python', 400000, now() - interval '14 days'),
  ('00000000-0000-0000-0000-0000000000i2','00000000-0000-0000-0000-0000000000b2','16 seats × DevOps Bootcamp', 320000, now() - interval '12 days');

-- Payments (Acme: half paid, half outstanding & aging; TCS: paid) -------------
insert into payment (invoice_id, amount, method, due_on, paid_at) values
  ('00000000-0000-0000-0000-0000000000i1', 200000, 'bank', current_date - 10, now() - interval '10 days'),
  ('00000000-0000-0000-0000-0000000000i1', 200000, 'bank', current_date - 3,  null),   -- outstanding, aging
  ('00000000-0000-0000-0000-0000000000i2', 320000, 'bank', current_date - 8,  now() - interval '8 days');

-- Expenses (cost side, tagged to the batch) -----------------------------------
insert into expense (batch_id, category, vendor, amount, occurred_at) values
  ('00000000-0000-0000-0000-0000000000b1','venue',    'WeWork BLR',   60000, now() - interval '18 days'),
  ('00000000-0000-0000-0000-0000000000b1','travel',   'Trainer travel',40000, now() - interval '17 days'),
  ('00000000-0000-0000-0000-0000000000b1','marketing','LinkedIn Ads',   4000, now() - interval '30 days'),
  ('00000000-0000-0000-0000-0000000000b2','venue',    'Venue Pune',    50000, now() - interval '14 days'),
  ('00000000-0000-0000-0000-0000000000b2','materials','Lab kits',      40000, now() - interval '13 days');

-- Trainer payments (cost side) ------------------------------------------------
insert into trainer_payment (batch_id, trainer_id, amount, occurred_at) values
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a3', 156000, now() - interval '5 days'),
  ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000a4', 300000, now() - interval '4 days');

-- Ledger events (audit + as-of; money events carry batch_id and a signed amount)
insert into ledger_event (occurred_at, event_type, entity_type, entity_id, batch_id, amount, payload) values
  (now() - interval '30 days','lead.created',       'enquiry',        '00000000-0000-0000-0000-0000000000e1', null,                                    null,    '{"source":"linkedin"}'),
  (now() - interval '30 days','expense.recorded',   'expense',        null,                                   '00000000-0000-0000-0000-0000000000b1',  -4000,  '{"category":"marketing"}'),
  (now() - interval '20 days','lead.converted',     'enquiry',        '00000000-0000-0000-0000-0000000000e1', null,                                    null,    '{}'),
  (now() - interval '20 days','batch.created',      'batch',          '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1',  null,    '{}'),
  (now() - interval '14 days','invoice.raised',     'invoice',        '00000000-0000-0000-0000-0000000000i1', '00000000-0000-0000-0000-0000000000b1',  400000, '{"gst_rate":18}'),
  (now() - interval '18 days','expense.recorded',   'expense',        null,                                   '00000000-0000-0000-0000-0000000000b1',  -60000, '{"category":"venue"}'),
  (now() - interval '10 days','payment.received',   'payment',        null,                                   '00000000-0000-0000-0000-0000000000b1',  null,    '{"amount":200000}'),
  (now() - interval '5 days', 'trainer_payment.recorded','trainer_payment', null,                             '00000000-0000-0000-0000-0000000000b1',  -156000,'{}');

-- Quick check (optional): select * from batch_pnl order by net_profit;
--   Acme →  +140000 ,  TCS →  -70000
