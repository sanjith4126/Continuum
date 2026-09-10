import { relations } from "drizzle-orm/relations";
import { party, enquiry, appUser, activity, course, batch, quotation, invoice, invoiceLine, expense, trainerPayment, ledgerEvent, enrollment, attendance, payment } from "./schema";

export const enquiryRelations = relations(enquiry, ({one, many}) => ({
	party: one(party, {
		fields: [enquiry.partyId],
		references: [party.id]
	}),
	appUser: one(appUser, {
		fields: [enquiry.ownerId],
		references: [appUser.id]
	}),
	activities: many(activity),
	batches: many(batch),
	quotations: many(quotation),
}));

export const partyRelations = relations(party, ({many}) => ({
	enquiries: many(enquiry),
	appUsers: many(appUser),
	activities: many(activity),
	batches: many(batch),
	quotations: many(quotation),
	trainerPayments: many(trainerPayment),
	enrollments: many(enrollment),
	invoices: many(invoice),
}));

export const appUserRelations = relations(appUser, ({one, many}) => ({
	enquiries: many(enquiry),
	party: one(party, {
		fields: [appUser.partyId],
		references: [party.id]
	}),
	activities: many(activity),
	ledgerEvents: many(ledgerEvent),
}));

export const activityRelations = relations(activity, ({one}) => ({
	enquiry: one(enquiry, {
		fields: [activity.enquiryId],
		references: [enquiry.id]
	}),
	party: one(party, {
		fields: [activity.partyId],
		references: [party.id]
	}),
	appUser: one(appUser, {
		fields: [activity.ownerId],
		references: [appUser.id]
	}),
}));

export const batchRelations = relations(batch, ({one, many}) => ({
	course: one(course, {
		fields: [batch.courseId],
		references: [course.id]
	}),
	party: one(party, {
		fields: [batch.trainerId],
		references: [party.id]
	}),
	enquiry: one(enquiry, {
		fields: [batch.sourceLeadId],
		references: [enquiry.id]
	}),
	invoiceLines: many(invoiceLine),
	expenses: many(expense),
	trainerPayments: many(trainerPayment),
	ledgerEvents: many(ledgerEvent),
	enrollments: many(enrollment),
	invoices: many(invoice),
}));

export const courseRelations = relations(course, ({many}) => ({
	batches: many(batch),
}));

export const quotationRelations = relations(quotation, ({one}) => ({
	enquiry: one(enquiry, {
		fields: [quotation.enquiryId],
		references: [enquiry.id]
	}),
	party: one(party, {
		fields: [quotation.partyId],
		references: [party.id]
	}),
}));

export const invoiceLineRelations = relations(invoiceLine, ({one}) => ({
	invoice: one(invoice, {
		fields: [invoiceLine.invoiceId],
		references: [invoice.id]
	}),
	batch: one(batch, {
		fields: [invoiceLine.batchId],
		references: [batch.id]
	}),
}));

export const invoiceRelations = relations(invoice, ({one, many}) => ({
	invoiceLines: many(invoiceLine),
	party: one(party, {
		fields: [invoice.partyId],
		references: [party.id]
	}),
	batch: one(batch, {
		fields: [invoice.batchId],
		references: [batch.id]
	}),
	payments: many(payment),
}));

export const expenseRelations = relations(expense, ({one}) => ({
	batch: one(batch, {
		fields: [expense.batchId],
		references: [batch.id]
	}),
}));

export const trainerPaymentRelations = relations(trainerPayment, ({one}) => ({
	batch: one(batch, {
		fields: [trainerPayment.batchId],
		references: [batch.id]
	}),
	party: one(party, {
		fields: [trainerPayment.trainerId],
		references: [party.id]
	}),
}));

export const ledgerEventRelations = relations(ledgerEvent, ({one}) => ({
	appUser: one(appUser, {
		fields: [ledgerEvent.actorId],
		references: [appUser.id]
	}),
	batch: one(batch, {
		fields: [ledgerEvent.batchId],
		references: [batch.id]
	}),
}));

export const enrollmentRelations = relations(enrollment, ({one, many}) => ({
	batch: one(batch, {
		fields: [enrollment.batchId],
		references: [batch.id]
	}),
	party: one(party, {
		fields: [enrollment.studentId],
		references: [party.id]
	}),
	attendances: many(attendance),
}));

export const attendanceRelations = relations(attendance, ({one}) => ({
	enrollment: one(enrollment, {
		fields: [attendance.enrollmentId],
		references: [enrollment.id]
	}),
}));

export const paymentRelations = relations(payment, ({one}) => ({
	invoice: one(invoice, {
		fields: [payment.invoiceId],
		references: [invoice.id]
	}),
}));