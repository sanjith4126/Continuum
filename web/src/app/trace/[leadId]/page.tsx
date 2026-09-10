import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
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
    <AppShell breadcrumb="Traceability">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-(--color-on-surface)">
          Enquiry → outcome
        </h1>
        <p className="mt-1 text-[13px] text-(--color-outline)">
          Lead {leadId.slice(0, 8)} traced from enquiry to margin.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
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
    </AppShell>
  );
}
