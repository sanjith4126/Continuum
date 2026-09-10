import { AppShell } from "@/components/AppShell";
import { PipelineRunner } from "./PipelineRunner";

export default function PipelinePage() {
  return (
    <AppShell breadcrumb="Run lifecycle">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-(--color-on-surface)">
          Lifecycle
        </h1>
        <p className="mt-1 mb-6 max-w-xl text-[13px] text-(--color-outline)">
          Walks one journey end to end — lead → convert → batch → enroll →
          invoice → payment → costs. Each step writes its row and appends a
          matching ledger event in the same transaction.
        </p>

        <PipelineRunner />
      </div>
    </AppShell>
  );
}
