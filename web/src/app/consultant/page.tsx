import Link from "next/link";
import { ConsultantChat } from "./ConsultantChat";

export default function ConsultantPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/dashboard"
          className="text-sm text-neutral-400 hover:text-neutral-900"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
          Data consultant
        </h1>
        <p className="mt-1 mb-8 max-w-xl text-sm text-neutral-500">
          Ask about batch profit, collections, or business-wide totals.
          Read-only, least-privilege — it can only see three views, never
          base tables or PII.
        </p>

        <ConsultantChat />
      </div>
    </div>
  );
}
