import { formatINR } from "@/lib/format";
import type { LeadOutcomeEvent } from "@/lib/queries";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function EventStrip({ events }: { events: LeadOutcomeEvent[] }) {
  return (
    <div className="rounded-lg border border-(--color-outline-variant) bg-(--color-surface-container-lowest) p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-(--color-on-surface)">
          Ledger events
        </h3>
        {/* This claim is true and directly testable: ledger_event has
            create rule ledger_no_update / ledger_no_delete in db/schema.sql
            — an UPDATE or DELETE against it is a silent no-op at the
            database level. No cryptographic verification (hashing, a
            Merkle root, tx signatures) exists here or is claimed. */}
        <span className="rounded bg-(--color-surface-container) px-1.5 py-0.5 font-(family-name:--font-data) text-[10px] uppercase tracking-wider text-(--color-on-surface-variant)">
          Append-only
        </span>
      </div>
      <ol className="space-y-3">
        {events.map((event) => (
          <li key={event.id} className="flex gap-2.5">
            <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-outline-variant)" />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-(family-name:--font-data) text-[12px] font-medium text-(--color-on-surface)">
                  {event.event_type}
                </span>
                {event.amount !== null && (
                  <span
                    className={
                      "font-(family-name:--font-data) text-[12px] " +
                      (Number(event.amount) >= 0
                        ? "text-(--color-profit-600)"
                        : "text-(--color-loss-600)")
                    }
                  >
                    {formatINR(event.amount)}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-(--color-outline)">
                {formatDateTime(event.occurred_at)}
              </div>
            </div>
          </li>
        ))}
        {events.length === 0 && (
          <li className="text-[13px] text-(--color-outline)">
            No events recorded.
          </li>
        )}
      </ol>
    </div>
  );
}
