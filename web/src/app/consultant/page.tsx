import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { ConsultantChat } from "./ConsultantChat";

export default async function ConsultantPage() {
  await requireUser("consultant");
  return (
    <AppShell breadcrumb="AI Consultant">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-(--color-on-surface)">
          AI Data Consultant
        </h1>
        <p className="mt-1 mb-6 max-w-xl text-[13px] text-(--color-outline)">
          Ask about batch profit, collections, or business-wide totals.
          Read-only, least-privilege — it can only see three views, never
          base tables or PII.
        </p>

        <ConsultantChat />
      </div>
    </AppShell>
  );
}
