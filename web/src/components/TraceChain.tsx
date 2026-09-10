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
    <div className="relative pl-7">
      <div className="absolute left-0 top-1 h-2.5 w-2.5 rounded-full border-2 border-(--color-accent-500) bg-(--color-surface-container-lowest)" />
      <div className="absolute left-1 top-4 -bottom-5 w-px bg-(--color-outline-variant) last:hidden" />
      <div className="mb-0.5 font-(family-name:--font-data) text-[10px] font-semibold uppercase tracking-wider text-(--color-outline)">
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
    <div className="space-y-5 rounded-lg border border-(--color-outline-variant) bg-(--color-surface-container-lowest) p-5">
      <Step title="Enquiry">
        <div className="text-[14px] font-medium text-(--color-on-surface)">
          {partyName}
        </div>
        <div className="text-[12px] text-(--color-on-surface-variant)">
          source: {lead?.source ?? "—"} · stage: {lead?.stage} · created{" "}
          {lead ? new Date(lead.created_at).toLocaleDateString("en-IN") : "—"}
        </div>
      </Step>

      <Step title="Batch">
        {batches.length === 0 && (
          <div className="text-[13px] text-(--color-outline)">No batch yet.</div>
        )}
        {batches.map((b) => (
          <div key={b.id} className="text-[13px]">
            <span className="font-medium text-(--color-on-surface)">{b.name}</span>{" "}
            <span className="text-(--color-on-surface-variant)">
              · {b.status} · {b.location ?? "—"}
              {b.starts_on ? ` · starts ${b.starts_on}` : ""}
            </span>
          </div>
        ))}
      </Step>

      <Step title="Invoice">
        {invoices.length === 0 && (
          <div className="text-[13px] text-(--color-outline)">No invoice yet.</div>
        )}
        {invoices.map((inv) => (
          <div key={inv.id} className="font-(family-name:--font-data) text-[12px] text-(--color-on-surface-variant)">
            Invoice {inv.id.slice(0, 8)} · {inv.status} · GST {inv.gst_rate}%
          </div>
        ))}
      </Step>

      <Step title="Payments">
        {payments.length === 0 && (
          <div className="text-[13px] text-(--color-outline)">No payments yet.</div>
        )}
        {payments.map((p) => (
          <div key={p.id} className="font-(family-name:--font-data) text-[12px] text-(--color-on-surface-variant)">
            {formatINR(p.amount)} · {p.method ?? "—"} ·{" "}
            {p.paidAt ? (
              <span className="text-(--color-profit-600)">
                paid {new Date(p.paidAt).toLocaleDateString("en-IN")}
              </span>
            ) : (
              <span className="text-(--color-warn-600)">
                outstanding{p.dueOn ? `, due ${p.dueOn}` : ""}
              </span>
            )}
          </div>
        ))}
      </Step>

      <Step title="Expenses">
        {expenses.length === 0 && trainerPayments.length === 0 && (
          <div className="text-[13px] text-(--color-outline)">No costs recorded.</div>
        )}
        {expenses.map((e) => (
          <div key={e.id} className="font-(family-name:--font-data) text-[12px] text-(--color-on-surface-variant)">
            {formatINR(e.amount)} · {e.category} · {e.vendor ?? "—"}
          </div>
        ))}
        {trainerPayments.map((tp) => (
          <div key={tp.id} className="font-(family-name:--font-data) text-[12px] text-(--color-on-surface-variant)">
            {formatINR(tp.amount)} · trainer_fee
          </div>
        ))}
      </Step>

      <Step title="Net margin">
        <div
          className={`font-(family-name:--font-data) text-[22px] font-semibold ${
            totalNetProfit >= 0 ? "text-(--color-profit-600)" : "text-(--color-loss-600)"
          }`}
        >
          {formatINR(totalNetProfit)}
        </div>
      </Step>
    </div>
  );
}
