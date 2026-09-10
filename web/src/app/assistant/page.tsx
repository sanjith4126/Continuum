import { AppShell } from "@/components/AppShell";
import { AssistantChat } from "./AssistantChat";
import { listStudents } from "@/lib/queries";

export default async function AssistantPage() {
  const students = await listStudents();

  return (
    <AppShell breadcrumb="Student Assistant">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-(--color-on-surface)">
          Student assistant
        </h1>
        <p className="mt-1 mb-6 max-w-xl text-[13px] text-(--color-outline)">
          Ask about your schedule or balance. Row-level security scopes
          every answer to your own enrollment — no free-form SQL here.
        </p>

        <AssistantChat students={students} />
      </div>
    </AppShell>
  );
}
