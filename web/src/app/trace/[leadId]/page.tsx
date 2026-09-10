import Link from "next/link";
import { notFound } from "next/navigation";
import { TraceChain } from "@/components/TraceChain";
import { EventStrip } from "@/components/EventStrip";
import {
  getLeadToOutcome,
  getPartyById,
  getPaymentsForInvoices,
  getExpensesForBatches,
  getTrainerPaymentsForBatches,
} from "@/lib/queries";

export default async function TracePage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;

  const outcome = await getLeadToOutcome(leadId);
  if (!outcome) notFound();

  const [party, payments, expenses, trainerPayments] = await Promise.all([
    getPartyById(outcome.lead!.party_id),
    getPaymentsForInvoices(outcome.invoices.map((i) => i.id)),
    getExpensesForBatches(outcome.batches.map((b) => b.id)),
    getTrainerPaymentsForBatches(outcome.batches.map((b) => b.id)),
  ]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Link
          href="/dashboard"
          className="text-sm text-neutral-400 hover:text-neutral-900"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
          Enquiry → outcome
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Lead {leadId.slice(0, 8)} traced from enquiry to margin.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TraceChain
              outcome={outcome}
              partyName={party?.name ?? "Unknown"}
              payments={payments}
              expenses={expenses}
              trainerPayments={trainerPayments}
            />
          </div>
          <div>
            <EventStrip events={outcome.events} />
          </div>
        </div>
      </div>
    </div>
  );
}
