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
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-medium text-neutral-500">
        Ledger events
      </h3>
      <ol className="space-y-4">
        {events.map((event) => (
          <li key={event.id} className="flex gap-3 text-sm">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-neutral-300" />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-neutral-900">
                  {event.event_type}
                </span>
                {event.amount !== null && (
                  <span
                    className={
                      Number(event.amount) >= 0
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }
                  >
                    {formatINR(event.amount)}
                  </span>
                )}
              </div>
              <div className="text-xs text-neutral-400">
                {formatDateTime(event.occurred_at)}
              </div>
            </div>
          </li>
        ))}
        {events.length === 0 && (
          <li className="text-sm text-neutral-400">No events recorded.</li>
        )}
      </ol>
    </div>
  );
}
