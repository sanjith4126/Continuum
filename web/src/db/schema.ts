import { pgTable, foreignKey, uuid, text, numeric, timestamp, index, check, unique, date, bigint, jsonb, pgPolicy, boolean, pgView, integer, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const batchStatus = pgEnum("batch_status", ['planned', 'running', 'completed', 'cancelled'])
export const eventType = pgEnum("event_type", ['lead.created', 'lead.contacted', 'lead.converted', 'lead.lost', 'quotation.sent', 'agreement.signed', 'batch.created', 'enrollment.created', 'attendance.marked', 'invoice.raised', 'invoice.line_added', 'payment.received', 'expense.recorded', 'trainer_payment.recorded', 'lms.completion', 'lms.attendance', 'party.created', 'course.created', 'batch.updated', 'payment.scheduled', 'payment.settled', 'account.created', 'account.updated', 'password.changed', 'password.reset_requested', 'lead.updated', 'batch.details_updated', 'payment.refunded'])
export const expenseCategory = pgEnum("expense_category", ['trainer_fee', 'venue', 'travel', 'materials', 'marketing', 'other'])
export const invoiceStatus = pgEnum("invoice_status", ['draft', 'issued', 'part_paid', 'paid', 'void'])
export const leadStage = pgEnum("lead_stage", ['new', 'contacted', 'qualified', 'quoted', 'won', 'lost'])
export const userRole = pgEnum("user_role", ['sales', 'ops', 'finance', 'trainer', 'management', 'student'])


export const enquiry = pgTable("enquiry", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	partyId: uuid("party_id").notNull(),
	source: text(),
	sourceCost: numeric("source_cost", { precision: 12, scale:  2 }).default('0').notNull(),
	stage: leadStage().default('new').notNull(),
	ownerId: uuid("owner_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.partyId],
			foreignColumns: [party.id],
			name: "enquiry_party_id_fkey"
		}),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [appUser.id],
			name: "enquiry_owner_id_fkey"
		}),
]);

export const party = pgTable("party", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	kind: text().notNull(),
	name: text().notNull(),
	email: text(),
	phone: text(),
	roles: text().array().default([""]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("party_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("party_name_idx").using("btree", sql`lower(name)`),
	check("party_kind_check", sql`kind = ANY (ARRAY['person'::text, 'org'::text])`),
]);

export const appUser = pgTable("app_user", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	partyId: uuid("party_id"),
	email: text().notNull(),
	role: userRole().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.partyId],
			foreignColumns: [party.id],
			name: "app_user_party_id_fkey"
		}),
	unique("app_user_email_key").on(table.email),
]);

export const activity = pgTable("activity", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	enquiryId: uuid("enquiry_id"),
	partyId: uuid("party_id"),
	kind: text().notNull(),
	note: text(),
	ownerId: uuid("owner_id"),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.enquiryId],
			foreignColumns: [enquiry.id],
			name: "activity_enquiry_id_fkey"
		}),
	foreignKey({
			columns: [table.partyId],
			foreignColumns: [party.id],
			name: "activity_party_id_fkey"
		}),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [appUser.id],
			name: "activity_owner_id_fkey"
		}),
]);

export const course = pgTable("course", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	defaultPrice: numeric("default_price", { precision: 12, scale:  2 }),
});

export const batch = pgTable("batch", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	courseId: uuid("course_id").notNull(),
	trainerId: uuid("trainer_id"),
	sourceLeadId: uuid("source_lead_id"),
	name: text().notNull(),
	location: text(),
	startsOn: date("starts_on"),
	endsOn: date("ends_on"),
	status: batchStatus().default('planned').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("batch_course_idx").using("btree", table.courseId.asc().nullsLast().op("uuid_ops")),
	index("batch_trainer_idx").using("btree", table.trainerId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [course.id],
			name: "batch_course_id_fkey"
		}),
	foreignKey({
			columns: [table.trainerId],
			foreignColumns: [party.id],
			name: "batch_trainer_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceLeadId],
			foreignColumns: [enquiry.id],
			name: "batch_source_lead_id_fkey"
		}),
]);

export const quotation = pgTable("quotation", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	enquiryId: uuid("enquiry_id"),
	partyId: uuid("party_id").notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	status: text().default('sent').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.enquiryId],
			foreignColumns: [enquiry.id],
			name: "quotation_enquiry_id_fkey"
		}),
	foreignKey({
			columns: [table.partyId],
			foreignColumns: [party.id],
			name: "quotation_party_id_fkey"
		}),
]);

export const invoiceLine = pgTable("invoice_line", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	invoiceId: uuid("invoice_id").notNull(),
	batchId: uuid("batch_id").notNull(),
	description: text(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	discount: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("invoice_line_batch_idx").using("btree", table.batchId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoice.id],
			name: "invoice_line_invoice_id_fkey"
		}),
	foreignKey({
			columns: [table.batchId],
			foreignColumns: [batch.id],
			name: "invoice_line_batch_id_fkey"
		}),
]);

export const expense = pgTable("expense", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	batchId: uuid("batch_id"),
	category: expenseCategory().notNull(),
	vendor: text(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("expense_batch_idx").using("btree", table.batchId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.batchId],
			foreignColumns: [batch.id],
			name: "expense_batch_id_fkey"
		}),
]);

export const trainerPayment = pgTable("trainer_payment", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	batchId: uuid("batch_id").notNull(),
	trainerId: uuid("trainer_id").notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("trainer_payment_batch_idx").using("btree", table.batchId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.batchId],
			foreignColumns: [batch.id],
			name: "trainer_payment_batch_id_fkey"
		}),
	foreignKey({
			columns: [table.trainerId],
			foreignColumns: [party.id],
			name: "trainer_payment_trainer_id_fkey"
		}),
]);

export const ledgerEvent = pgTable("ledger_event", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "ledger_event_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	actorId: uuid("actor_id"),
	eventType: eventType("event_type").notNull(),
	entityType: text("entity_type").notNull(),
	entityId: uuid("entity_id"),
	batchId: uuid("batch_id"),
	amount: numeric({ precision: 12, scale:  2 }),
	payload: jsonb().default({}).notNull(),
}, (table) => [
	index("ledger_batch_idx").using("btree", table.batchId.asc().nullsLast().op("uuid_ops")),
	index("ledger_entity_idx").using("btree", table.entityType.asc().nullsLast().op("text_ops"), table.entityId.asc().nullsLast().op("uuid_ops")),
	index("ledger_time_idx").using("btree", table.occurredAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.actorId],
			foreignColumns: [appUser.id],
			name: "ledger_event_actor_id_fkey"
		}),
	foreignKey({
			columns: [table.batchId],
			foreignColumns: [batch.id],
			name: "ledger_event_batch_id_fkey"
		}),
]);

export const enrollment = pgTable("enrollment", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	batchId: uuid("batch_id").notNull(),
	studentId: uuid("student_id").notNull(),
	enrolledAt: timestamp("enrolled_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	status: text().default('active').notNull(),
}, (table) => [
	index("enrollment_batch_idx").using("btree", table.batchId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.batchId],
			foreignColumns: [batch.id],
			name: "enrollment_batch_id_fkey"
		}),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [party.id],
			name: "enrollment_student_id_fkey"
		}),
	unique("enrollment_batch_id_student_id_key").on(table.studentId, table.batchId),
	pgPolicy("enrollment_access", { as: "permissive", for: "select", to: ["public"], using: sql`((current_setting('app.user_role'::text, true) <> 'student'::text) OR (student_id = (NULLIF(current_setting('app.party_id'::text, true), ''::text))::uuid))` }),
]);

export const attendance = pgTable("attendance", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	enrollmentId: uuid("enrollment_id").notNull(),
	sessionDate: date("session_date").notNull(),
	present: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.enrollmentId],
			foreignColumns: [enrollment.id],
			name: "attendance_enrollment_id_fkey"
		}),
	unique("attendance_enrollment_session_key").on(table.enrollmentId, table.sessionDate),
	pgPolicy("attendance_access", { as: "permissive", for: "select", to: ["public"], using: sql`((current_setting('app.user_role'::text, true) <> 'student'::text) OR (enrollment_id IN ( SELECT enrollment.id
   FROM enrollment
  WHERE (enrollment.student_id = (NULLIF(current_setting('app.party_id'::text, true), ''::text))::uuid))))` }),
]);

export const invoice = pgTable("invoice", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	partyId: uuid("party_id").notNull(),
	batchId: uuid("batch_id"),
	status: invoiceStatus().default('issued').notNull(),
	gstRate: numeric("gst_rate", { precision: 5, scale:  2 }).default('18').notNull(),
	issuedAt: timestamp("issued_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("invoice_party_idx").using("btree", table.partyId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.partyId],
			foreignColumns: [party.id],
			name: "invoice_party_id_fkey"
		}),
	foreignKey({
			columns: [table.batchId],
			foreignColumns: [batch.id],
			name: "invoice_batch_id_fkey"
		}),
	pgPolicy("invoice_access", { as: "permissive", for: "select", to: ["public"], using: sql`((current_setting('app.user_role'::text, true) = ANY (ARRAY['finance'::text, 'management'::text, 'sales'::text, 'ops'::text])) OR (party_id = (NULLIF(current_setting('app.party_id'::text, true), ''::text))::uuid))` }),
]);

export const payment = pgTable("payment", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	invoiceId: uuid("invoice_id").notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	method: text(),
	dueOn: date("due_on"),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("payment_invoice_idx").using("btree", table.invoiceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoice.id],
			name: "payment_invoice_id_fkey"
		}),
	pgPolicy("payment_access", { as: "permissive", for: "select", to: ["public"], using: sql`((current_setting('app.user_role'::text, true) = ANY (ARRAY['finance'::text, 'management'::text, 'sales'::text, 'ops'::text])) OR (invoice_id IN ( SELECT invoice.id
   FROM invoice
  WHERE (invoice.party_id = (NULLIF(current_setting('app.party_id'::text, true), ''::text))::uuid))))` }),
]);
export const batchPnl = pgView("batch_pnl", {	batchId: uuid("batch_id"),
	name: text(),
	revenue: numeric(),
	cost: numeric(),
	netProfit: numeric("net_profit"),
}).as(sql`SELECT b.id AS batch_id, b.name, COALESCE(r.revenue, 0::numeric) AS revenue, COALESCE(c.cost, 0::numeric) AS cost, COALESCE(r.revenue, 0::numeric) - COALESCE(c.cost, 0::numeric) AS net_profit FROM batch b LEFT JOIN ( SELECT invoice_line.batch_id, sum(invoice_line.amount - invoice_line.discount) AS revenue FROM invoice_line GROUP BY invoice_line.batch_id) r ON r.batch_id = b.id LEFT JOIN ( SELECT costs.batch_id, sum(costs.amount) AS cost FROM ( SELECT expense.batch_id, expense.amount FROM expense WHERE expense.batch_id IS NOT NULL UNION ALL SELECT trainer_payment.batch_id, trainer_payment.amount FROM trainer_payment) costs GROUP BY costs.batch_id) c ON c.batch_id = b.id`);

export const collectionsAging = pgView("collections_aging", {	paymentId: uuid("payment_id"),
	partyId: uuid("party_id"),
	batchId: uuid("batch_id"),
	amount: numeric({ precision: 12, scale:  2 }),
	dueOn: date("due_on"),
	daysOverdue: integer("days_overdue"),
	rupeesAtRisk: numeric("rupees_at_risk"),
}).as(sql`SELECT p.id AS payment_id, i.party_id, i.batch_id, p.amount, p.due_on, CURRENT_DATE - p.due_on AS days_overdue, p.amount * GREATEST(CURRENT_DATE - p.due_on, 0)::numeric AS rupees_at_risk FROM payment p JOIN invoice i ON i.id = p.invoice_id WHERE p.paid_at IS NULL AND p.due_on IS NOT NULL ORDER BY (p.amount * GREATEST(CURRENT_DATE - p.due_on, 0)::numeric) DESC`);

export const dashboardKpis = pgView("dashboard_kpis", {	revenue: numeric(),
	collected: numeric(),
	outstanding: numeric(),
	totalCost: numeric("total_cost"),
	netProfit: numeric("net_profit"),
}).as(sql`SELECT ( SELECT COALESCE(sum(invoice_line.amount - invoice_line.discount), 0::numeric) AS "coalesce" FROM invoice_line) AS revenue, ( SELECT COALESCE(sum(payment.amount), 0::numeric) AS "coalesce" FROM payment WHERE payment.paid_at IS NOT NULL) AS collected, ( SELECT COALESCE(sum(payment.amount), 0::numeric) AS "coalesce" FROM payment WHERE payment.paid_at IS NULL) AS outstanding, (( SELECT COALESCE(sum(expense.amount), 0::numeric) AS "coalesce" FROM expense)) + (( SELECT COALESCE(sum(trainer_payment.amount), 0::numeric) AS "coalesce" FROM trainer_payment)) AS total_cost, ( SELECT COALESCE(sum(batch_pnl.net_profit), 0::numeric) AS "coalesce" FROM batch_pnl) AS net_profit`);
