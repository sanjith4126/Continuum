import Link from "next/link";
import { AssistantChat } from "./AssistantChat";
import { listStudents } from "@/lib/queries";

export default async function AssistantPage() {
  const students = await listStudents();

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link
          href="/dashboard"
          className="text-sm text-neutral-400 hover:text-neutral-900"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
          Student assistant
        </h1>
        <p className="mt-1 mb-8 max-w-xl text-sm text-neutral-500">
          Ask about your schedule or balance. Row-level security scopes
          every answer to your own enrollment — no free-form SQL here.
        </p>

        <AssistantChat students={students} />
      </div>
    </div>
  );
}
