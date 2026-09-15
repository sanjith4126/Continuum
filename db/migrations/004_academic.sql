-- Academic layer: course materials, graded assignments (MCQ + programming
-- with auto-grading), daily practice questions, and announcements —
-- ported from the standalone LMS prototype and re-attached to Continuum's
-- existing batch/enrollment/party model instead of a second user/course
-- table. A batch IS the cohort/instance the LMS called a "course
-- enrollment scope"; enrollment.student_id (already a party) is the
-- student identity; the assigned trainer (batch.trainer_id) is the
-- instructor of record — no new identity or course concept introduced.
--
-- Content type discipline matches the LMS original: question_options /
-- question_test_cases are separate tables (not fixed columns), so a
-- faculty member isn't boxed into a fixed number of MCQ choices or test
-- cases. Daily practice questions mirror the assignment-question shape
-- but are a separate, ungraded, date-released queue.

create type material_type   as enum ('note','link','file','video');
create type question_type   as enum ('mcq','program');
create type submission_status as enum ('submitted','late','graded');

-- week_number groups content the way NPTEL/similar platforms do
-- (Week 0 = general, ahead of Week 1..N).
create table course_material (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references batch(id),
  title        text not null check (btrim(title) <> '' and length(title) <= 200),
  type         material_type not null,
  content      text,
  file_path    text,
  week_number  int not null default 0,
  uploaded_by  uuid references app_user(id),
  created_at   timestamptz not null default now()
);
create index course_material_batch_idx on course_material (batch_id);

create table assignment (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references batch(id),
  title        text not null check (btrim(title) <> '' and length(title) <= 200),
  description  text,
  due_date     timestamptz not null,
  max_points   int not null default 100 check (max_points > 0),
  week_number  int not null default 0,
  created_by   uuid references app_user(id),
  created_at   timestamptz not null default now()
);
create index assignment_batch_idx on assignment (batch_id);

create table assignment_submission (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignment(id) on delete cascade,
  enrollment_id uuid not null references enrollment(id) on delete cascade,
  file_path     text,
  content       text,
  submitted_at  timestamptz not null default now(),
  status        submission_status not null default 'submitted',
  grade         int,
  feedback      text,
  auto_score    int,
  unique (assignment_id, enrollment_id)
);
create index assignment_submission_assignment_idx on assignment_submission (assignment_id);

-- Questions belong to an assignment. MCQ options and program test cases
-- live in their own child tables (any count, any number of correct
-- options) rather than fixed A-D columns.
create table assignment_question (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignment(id) on delete cascade,
  type          question_type not null,
  position      int not null default 0,
  question_text text not null,
  points        int not null default 10 check (points > 0),
  language      text,
  starter_code  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index assignment_question_assignment_idx on assignment_question (assignment_id);

create table assignment_question_option (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references assignment_question(id) on delete cascade,
  option_text text not null,
  is_correct  boolean not null default false,
  position    int not null default 0
);
create index assignment_question_option_question_idx on assignment_question_option (question_id);

create table assignment_question_test_case (
  id              uuid primary key default gen_random_uuid(),
  question_id     uuid not null references assignment_question(id) on delete cascade,
  input           text not null,
  expected_output text not null,
  position        int not null default 0
);
create index assignment_question_test_case_question_idx on assignment_question_test_case (question_id);

-- One row per (submission, question). MCQ: selections are the join table
-- below. Programming: code_answer holds the submitted code. is_correct/
-- points_awarded are filled by auto-grading (MCQ) or faculty review (program).
create table assignment_answer (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references assignment_submission(id) on delete cascade,
  question_id   uuid not null references assignment_question(id) on delete cascade,
  code_answer   text,
  is_correct    boolean,
  points_awarded int,
  answered_at   timestamptz not null default now(),
  unique (submission_id, question_id)
);
create index assignment_answer_submission_idx on assignment_answer (submission_id);

create table assignment_answer_selection (
  id        uuid primary key default gen_random_uuid(),
  answer_id uuid not null references assignment_answer(id) on delete cascade,
  option_id uuid not null references assignment_question_option(id) on delete cascade,
  unique (answer_id, option_id)
);

-- Daily practice: separate from graded assignments, released to students
-- once scheduled_date arrives. Ungraded in the sense of "not part of the
-- batch's assignment grade" -- MCQ still auto-scores, programming answers
-- are stored for trainer review.
create table daily_question (
  id             uuid primary key default gen_random_uuid(),
  batch_id       uuid not null references batch(id),
  type           question_type not null,
  position       int not null default 0,
  question_text  text not null,
  points         int not null default 10 check (points > 0),
  language       text,
  starter_code   text,
  scheduled_date date not null,
  created_by     uuid references app_user(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index daily_question_batch_idx on daily_question (batch_id);

create table daily_question_option (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references daily_question(id) on delete cascade,
  option_text text not null,
  is_correct  boolean not null default false,
  position    int not null default 0
);

create table daily_question_test_case (
  id              uuid primary key default gen_random_uuid(),
  question_id     uuid not null references daily_question(id) on delete cascade,
  input           text not null,
  expected_output text not null,
  position        int not null default 0
);

create table daily_answer (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references daily_question(id) on delete cascade,
  enrollment_id uuid not null references enrollment(id) on delete cascade,
  code_answer   text,
  is_correct    boolean,
  points_awarded int,
  answered_at   timestamptz not null default now(),
  unique (question_id, enrollment_id)
);

create table daily_answer_selection (
  id        uuid primary key default gen_random_uuid(),
  answer_id uuid not null references daily_answer(id) on delete cascade,
  option_id uuid not null references daily_question_option(id) on delete cascade,
  unique (answer_id, option_id)
);

create table announcement (
  id         uuid primary key default gen_random_uuid(),
  batch_id   uuid not null references batch(id),
  title      text not null check (btrim(title) <> '' and length(title) <= 200),
  body       text not null,
  posted_by  uuid references app_user(id),
  created_at timestamptz not null default now()
);
create index announcement_batch_idx on announcement (batch_id);

-- New ledger event types for the academic layer, matching the append-only
-- audit pattern used everywhere else in the system.
alter type event_type add value if not exists 'assignment.created';
alter type event_type add value if not exists 'assignment.submitted';
alter type event_type add value if not exists 'assignment.graded';
alter type event_type add value if not exists 'material.posted';
alter type event_type add value if not exists 'announcement.posted';
alter type event_type add value if not exists 'daily_question.answered';

-- Row-level security: a student (via enrollment) sees only their own
-- submissions/answers; a trainer sees only batches they're assigned to.
-- Reuses the same continuum_staff / RLS pattern as the rest of the schema
-- -- see scripts/setup-*-role.js for how these roles are provisioned.
alter table assignment_submission enable row level security;
alter table assignment_answer enable row level security;
alter table daily_answer enable row level security;

create policy assignment_submission_access on assignment_submission for select using (
  exists (
    select 1 from enrollment e
    where e.id = assignment_submission.enrollment_id
    and e.student_id = current_setting('app.party_id', true)::uuid
  )
  or exists (
    select 1 from assignment a join batch b on b.id = a.batch_id
    where a.id = assignment_submission.assignment_id
    and b.trainer_id = current_setting('app.party_id', true)::uuid
  )
);
create policy assignment_submission_write on assignment_submission for all to continuum_staff
  using (true) with check (true);

create policy assignment_answer_access on assignment_answer for select using (
  exists (
    select 1 from assignment_submission s join enrollment e on e.id = s.enrollment_id
    where s.id = assignment_answer.submission_id
    and e.student_id = current_setting('app.party_id', true)::uuid
  )
  or exists (
    select 1 from assignment_submission s
    join assignment a on a.id = s.assignment_id
    join batch b on b.id = a.batch_id
    where s.id = assignment_answer.submission_id
    and b.trainer_id = current_setting('app.party_id', true)::uuid
  )
);
create policy assignment_answer_write on assignment_answer for all to continuum_staff
  using (true) with check (true);

create policy daily_answer_access on daily_answer for select using (
  exists (
    select 1 from enrollment e
    where e.id = daily_answer.enrollment_id
    and e.student_id = current_setting('app.party_id', true)::uuid
  )
  or exists (
    select 1 from daily_question q join batch b on b.id = q.batch_id
    where q.id = daily_answer.question_id
    and b.trainer_id = current_setting('app.party_id', true)::uuid
  )
);
create policy daily_answer_write on daily_answer for all to continuum_staff
  using (true) with check (true);

-- continuum_staff already has broad grants from 001_production.sql on the
-- pre-existing tables; extend the same grant set to the new ones so
-- authorizedTransaction()'s SET LOCAL ROLE continuum_staff works for
-- academic writes exactly the same way it does for CRM/finance writes.
grant select, insert, update, delete on
  course_material, assignment, assignment_submission, assignment_question,
  assignment_question_option, assignment_question_test_case,
  assignment_answer, assignment_answer_selection,
  daily_question, daily_question_option, daily_question_test_case,
  daily_answer, daily_answer_selection, announcement
to continuum_staff;

-- continuum_app (the RLS-scoped read role used by the student assistant)
-- gets read access to the student-facing academic tables too, so a future
-- "what's my next assignment" tool can be added the same way
-- student_schedule/student_balance were.
grant select on
  course_material, assignment, assignment_submission, assignment_question,
  assignment_question_option, assignment_question_test_case,
  assignment_answer, daily_question, daily_question_option, daily_answer,
  announcement
to continuum_app;
