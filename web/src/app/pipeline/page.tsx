import Link from "next/link";
import { PipelineRunner } from "./PipelineRunner";

export default function PipelinePage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <Link
          href="/dashboard"
          className="text-sm text-neutral-400 hover:text-neutral-900"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
          Lifecycle
        </h1>
        <p className="mt-1 mb-8 max-w-xl text-sm text-neutral-500">
          Walks one journey end to end — lead → convert → batch → enroll →
          invoice → payment → costs. Each step writes its row and appends a
          matching ledger event in the same transaction.
        </p>

        <PipelineRunner />
      </div>
    </div>
  );
}
