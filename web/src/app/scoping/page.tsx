import { AppShell } from "@/components/AppShell";
import { ScopingChat } from "./ScopingChat";
import { authorizedTransaction } from "@/lib/transaction";
import { sql } from "drizzle-orm";

async function leadOptions() {
  return authorizedTransaction("crm", async (tx) => {
    const rows = await tx.execute(sql`select e.id, p.name from enquiry e join party p on p.id=e.party_id where e.stage in ('qualified','quoted','won') order by e.created_at desc limit 100`);
    return rows.rows.map((r) => ({ value: String(r.id), label: String(r.name) }));
  });
}

export default async function ScopingPage() {
  const leads = await leadOptions();
  return (
    <AppShell breadcrumb="AI program scoping">
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <header>
          <p className="eyebrow">SALES / AI CONSULTANT</p>
          <h1 className="mt-3 text-3xl font-semibold">Scope a training programme<br />the way a business analyst would.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            A structured interview — business need, audience, curriculum, delivery, budget — that produces a scoping brief and a cost
            estimate you can turn directly into a quotation for the lead. Say &quot;I don&apos;t know&quot; to skip any question.
          </p>
        </header>
        <ScopingChat leads={leads} />
      </div>
    </AppShell>
  );
}
