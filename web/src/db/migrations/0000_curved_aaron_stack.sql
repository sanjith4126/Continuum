-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."batch_status" AS ENUM('planned', 'running', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('lead.created', 'lead.contacted', 'lead.converted', 'lead.lost', 'quotation.sent', 'agreement.signed', 'batch.created', 'enrollment.created', 'attendance.marked', 'invoice.raised', 'invoice.line_added', 'payment.received', 'expense.recorded', 'trainer_payment.recorded', 'lms.completion', 'lms.attendance');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('trainer_fee', 'venue', 'travel', 'materials', 'marketing', 'other');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'part_paid', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('new', 'contacted', 'qualified', 'quoted', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('sales', 'ops', 'finance', 'trainer', 'management', 'student');--> statement-breakpoint
CREATE TABLE "enquiry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid NOT NULL,
	"source" text,
	"source_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"stage" "lead_stage" DEFAULT 'new' NOT NULL,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"roles" text[] DEFAULT '{""}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "party_kind_check" CHECK (kind = ANY (ARRAY['person'::text, 'org'::text]))
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid,
	"email" text NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_id" uuid,
	"party_id" uuid,
	"kind" text NOT NULL,
	"note" text,
	"owner_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"default_price" numeric(12, 2)
);
--> statement-breakpoint
CREATE TABLE "batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"trainer_id" uuid,
	"source_lead_id" uuid,
	"name" text NOT NULL,
	"location" text,
	"starts_on" date,
	"ends_on" date,
	"status" "batch_status" DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_id" uuid,
	"party_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"description" text,
	"amount" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid,
	"category" "expense_category" NOT NULL,
	"vendor" text,
	"amount" numeric(12, 2) NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trainer_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"trainer_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ledger_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"event_type" "event_type" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"batch_id" uuid,
	"amount" numeric(12, 2),
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "enrollment_batch_id_student_id_key" UNIQUE("student_id","batch_id")
);
--> statement-breakpoint
ALTER TABLE "enrollment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"session_date" date NOT NULL,
	"present" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid NOT NULL,
	"batch_id" uuid,
	"status" "invoice_status" DEFAULT 'issued' NOT NULL,
	"gst_rate" numeric(5, 2) DEFAULT '18' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" text,
	"due_on" date,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "payment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "enquiry" ADD CONSTRAINT "enquiry_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry" ADD CONSTRAINT "enquiry_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."party"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_source_lead_id_fkey" FOREIGN KEY ("source_lead_id") REFERENCES "public"."enquiry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_payment" ADD CONSTRAINT "trainer_payment_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_payment" ADD CONSTRAINT "trainer_payment_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "public"."party"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_event" ADD CONSTRAINT "ledger_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_event" ADD CONSTRAINT "ledger_event_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."party"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "party_email_idx" ON "party" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "party_name_idx" ON "party" USING btree (lower(name) text_ops);--> statement-breakpoint
CREATE INDEX "batch_course_idx" ON "batch" USING btree ("course_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "batch_trainer_idx" ON "batch" USING btree ("trainer_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "invoice_line_batch_idx" ON "invoice_line" USING btree ("batch_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "expense_batch_idx" ON "expense" USING btree ("batch_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "trainer_payment_batch_idx" ON "trainer_payment" USING btree ("batch_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ledger_batch_idx" ON "ledger_event" USING btree ("batch_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ledger_entity_idx" ON "ledger_event" USING btree ("entity_type" text_ops,"entity_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ledger_time_idx" ON "ledger_event" USING btree ("occurred_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "enrollment_batch_idx" ON "enrollment" USING btree ("batch_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "invoice_party_idx" ON "invoice" USING btree ("party_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "payment_invoice_idx" ON "payment" USING btree ("invoice_id" uuid_ops);--> statement-breakpoint
CREATE VIEW "public"."batch_pnl" AS (SELECT b.id AS batch_id, b.name, COALESCE(r.revenue, 0::numeric) AS revenue, COALESCE(c.cost, 0::numeric) AS cost, COALESCE(r.revenue, 0::numeric) - COALESCE(c.cost, 0::numeric) AS net_profit FROM batch b LEFT JOIN ( SELECT invoice_line.batch_id, sum(invoice_line.amount - invoice_line.discount) AS revenue FROM invoice_line GROUP BY invoice_line.batch_id) r ON r.batch_id = b.id LEFT JOIN ( SELECT costs.batch_id, sum(costs.amount) AS cost FROM ( SELECT expense.batch_id, expense.amount FROM expense WHERE expense.batch_id IS NOT NULL UNION ALL SELECT trainer_payment.batch_id, trainer_payment.amount FROM trainer_payment) costs GROUP BY costs.batch_id) c ON c.batch_id = b.id);--> statement-breakpoint
CREATE VIEW "public"."collections_aging" AS (SELECT p.id AS payment_id, i.party_id, i.batch_id, p.amount, p.due_on, CURRENT_DATE - p.due_on AS days_overdue, p.amount * GREATEST(CURRENT_DATE - p.due_on, 0)::numeric AS rupees_at_risk FROM payment p JOIN invoice i ON i.id = p.invoice_id WHERE p.paid_at IS NULL AND p.due_on IS NOT NULL ORDER BY (p.amount * GREATEST(CURRENT_DATE - p.due_on, 0)::numeric) DESC);--> statement-breakpoint
CREATE VIEW "public"."dashboard_kpis" AS (SELECT ( SELECT COALESCE(sum(invoice_line.amount - invoice_line.discount), 0::numeric) AS "coalesce" FROM invoice_line) AS revenue, ( SELECT COALESCE(sum(payment.amount), 0::numeric) AS "coalesce" FROM payment WHERE payment.paid_at IS NOT NULL) AS collected, ( SELECT COALESCE(sum(payment.amount), 0::numeric) AS "coalesce" FROM payment WHERE payment.paid_at IS NULL) AS outstanding, (( SELECT COALESCE(sum(expense.amount), 0::numeric) AS "coalesce" FROM expense)) + (( SELECT COALESCE(sum(trainer_payment.amount), 0::numeric) AS "coalesce" FROM trainer_payment)) AS total_cost, ( SELECT COALESCE(sum(batch_pnl.net_profit), 0::numeric) AS "coalesce" FROM batch_pnl) AS net_profit);--> statement-breakpoint
CREATE POLICY "enrollment_access" ON "enrollment" AS PERMISSIVE FOR SELECT TO public USING (((current_setting('app.user_role'::text, true) <> 'student'::text) OR (student_id = (NULLIF(current_setting('app.party_id'::text, true), ''::text))::uuid)));--> statement-breakpoint
CREATE POLICY "attendance_access" ON "attendance" AS PERMISSIVE FOR SELECT TO public USING (((current_setting('app.user_role'::text, true) <> 'student'::text) OR (enrollment_id IN ( SELECT enrollment.id
   FROM enrollment
  WHERE (enrollment.student_id = (NULLIF(current_setting('app.party_id'::text, true), ''::text))::uuid)))));--> statement-breakpoint
CREATE POLICY "invoice_access" ON "invoice" AS PERMISSIVE FOR SELECT TO public USING (((current_setting('app.user_role'::text, true) = ANY (ARRAY['finance'::text, 'management'::text, 'sales'::text, 'ops'::text])) OR (party_id = (NULLIF(current_setting('app.party_id'::text, true), ''::text))::uuid)));--> statement-breakpoint
CREATE POLICY "payment_access" ON "payment" AS PERMISSIVE FOR SELECT TO public USING (((current_setting('app.user_role'::text, true) = ANY (ARRAY['finance'::text, 'management'::text, 'sales'::text, 'ops'::text])) OR (invoice_id IN ( SELECT invoice.id
   FROM invoice
  WHERE (invoice.party_id = (NULLIF(current_setting('app.party_id'::text, true), ''::text))::uuid)))));
*/