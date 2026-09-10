import { formatINR } from "@/lib/format";
import type { LeadOutcome } from "@/lib/queries";

type PaymentRow = { id: string; amount: string; method: string | null; dueOn: string | null; paidAt: string | null; invoiceId: string };
type ExpenseRow = { id: string; category: string; vendor: string | null; amount: string; occurredAt: string };
type TrainerPaymentRow = { id: string; trainerId: string; amount: string; occurredAt: string };

function Step({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative pl-8">
      <div className="absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-neutral-900 bg-white" />
      <div className="absolute left-1.25 top-5 -bottom-6 w-px bg-neutral-200 last:hidden" />
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function TraceChain({
  outcome,
  partyName,
  payments,
  expenses,
  trainerPayments,
}: {
  outcome: LeadOutcome;
  partyName: string;
  payments: PaymentRow[];
  expenses: ExpenseRow[];
  trainerPayments: TrainerPaymentRow[];
}) {
  const { lead, batches, invoices, pnl } = outcome;
  const totalNetProfit = pnl.reduce((sum, p) => sum + Number(p.net_profit), 0);

  return (
    <div className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <Step title="Enquiry">
        <div className="text-base font-medium text-neutral-900">
          {partyName}
        </div>
        <div className="text-sm text-neutral-500">
          source: {lead?.source ?? "—"} · stage: {lead?.stage} · created{" "}
          {lead ? new Date(lead.created_at).toLocaleDateString("en-IN") : "—"}
        </div>
      </Step>

      <Step title="Batch">
        {batches.length === 0 && (
          <div className="text-sm text-neutral-400">No batch yet.</div>
        )}
        {batches.map((b) => (
          <div key={b.id} className="text-sm">
            <span className="font-medium text-neutral-900">{b.name}</span>{" "}
            <span className="text-neutral-500">
              · {b.status} · {b.location ?? "—"}
              {b.starts_on ? ` · starts ${b.starts_on}` : ""}
            </span>
          </div>
        ))}
      </Step>

      <Step title="Invoice">
        {invoices.length === 0 && (
          <div className="text-sm text-neutral-400">No invoice yet.</div>
        )}
        {invoices.map((inv) => (
          <div key={inv.id} className="text-sm text-neutral-700">
            Invoice {inv.id.slice(0, 8)} · {inv.status} · GST {inv.gst_rate}%
          </div>
        ))}
      </Step>

      <Step title="Payments">
        {payments.length === 0 && (
          <div className="text-sm text-neutral-400">No payments yet.</div>
        )}
        {payments.map((p) => (
          <div key={p.id} className="text-sm text-neutral-700">
            {formatINR(p.amount)} · {p.method ?? "—"} ·{" "}
            {p.paidAt ? (
              <span className="text-emerald-600">
                paid {new Date(p.paidAt).toLocaleDateString("en-IN")}
              </span>
            ) : (
              <span className="text-amber-600">
                outstanding{p.dueOn ? `, due ${p.dueOn}` : ""}
              </span>
            )}
          </div>
        ))}
      </Step>

      <Step title="Expenses">
        {expenses.length === 0 && trainerPayments.length === 0 && (
          <div className="text-sm text-neutral-400">No costs recorded.</div>
        )}
        {expenses.map((e) => (
          <div key={e.id} className="text-sm text-neutral-700">
            {formatINR(e.amount)} · {e.category} · {e.vendor ?? "—"}
          </div>
        ))}
        {trainerPayments.map((tp) => (
          <div key={tp.id} className="text-sm text-neutral-700">
            {formatINR(tp.amount)} · trainer_fee
          </div>
        ))}
      </Step>

      <Step title="Net margin">
        <div
          className={`text-2xl font-semibold ${
            totalNetProfit >= 0 ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {formatINR(totalNetProfit)}
        </div>
      </Step>
    </div>
  );
}
