import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AssignmentTaker } from "@/components/AssignmentTaker";
import { assignmentDetail, academicLearnData } from "@/lib/academicWorkspace";

export default async function AssignmentTakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, learnData] = await Promise.all([assignmentDetail(id, true), academicLearnData()]);
  if (!detail.assignment) notFound();

  const mySubmission = learnData.mySubmissions.find((s) => String(s.assignment_id) === id);

  return (
    <AppShell breadcrumb="Assignment">
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <header>
          <p className="eyebrow">{String(detail.assignment.batch_name)}</p>
          <h1 className="mt-3 text-2xl font-semibold">{String(detail.assignment.title)}</h1>
          {detail.assignment.description ? <p className="mt-2 text-sm text-slate-500">{String(detail.assignment.description)}</p> : null}
          <p className="mt-2 text-xs text-slate-400">
            Due {String(detail.assignment.due_date).slice(0, 16).replace("T", " ")} · {String(detail.assignment.max_points)} points
          </p>
        </header>

        {mySubmission?.status === "graded" && (
          <div className="panel border-green-200 bg-green-50">
            <p className="text-sm font-semibold text-green-800">Graded: {String(mySubmission.grade)} / {String(detail.assignment.max_points)}</p>
            {mySubmission.feedback ? <p className="mt-1 text-sm text-green-700">{String(mySubmission.feedback)}</p> : null}
          </div>
        )}

        <AssignmentTaker
          assignmentId={id}
          questions={detail.questions.map((q) => ({
            id: String(q.id),
            type: q.type as "mcq" | "program",
            question_text: String(q.question_text),
            points: Number(q.points),
            language: q.language as string | null,
            starter_code: q.starter_code as string | null,
            options: (q.options as { id: unknown; option_text: unknown }[]).map((o) => ({ id: String(o.id), option_text: String(o.option_text) })),
            testCases: (q.testCases as { input: unknown; expected_output: unknown }[]).map((t) => ({ input: String(t.input), expected_output: String(t.expected_output) })),
          }))}
          existingContent={mySubmission ? "" : ""}
          alreadySubmitted={!!mySubmission}
        />
      </div>
    </AppShell>
  );
}
