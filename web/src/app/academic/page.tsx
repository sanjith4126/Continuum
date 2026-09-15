import { AppShell } from "@/components/AppShell";
import { AcademicSimpleForm } from "@/components/AcademicSimpleForm";
import { AssignmentBuilderForm } from "@/components/AssignmentBuilderForm";
import { GradeForm } from "@/components/GradeForm";
import { DataTable } from "@/components/DataTable";
import { academicTeachData, options } from "@/lib/academicWorkspace";

export default async function AcademicPage() {
  const d = await academicTeachData();
  const batches = options(d.batches);

  return (
    <AppShell breadcrumb="Coursework & grading">
      <div className="mx-auto max-w-6xl space-y-7 px-6 py-8">
        <header>
          <p className="eyebrow">DELIVERY / COURSEWORK</p>
          <h1 className="mt-3 text-3xl font-semibold">Run the actual programme,<br />not just the roster.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Materials, assignments, daily practice and grading — attached to the same batches you already manage in Training. A trainer only
            sees their own assigned batches here, same as Training operations.
          </p>
        </header>

        {batches.length === 0 ? (
          <div className="panel text-sm text-slate-500">No batches assigned yet — create or get assigned a batch in Training operations first.</div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <AcademicSimpleForm
              title="Post course material"
              kind="material"
              fields={[
                { name: "batchId", label: "Batch", options: batches },
                { name: "title", label: "Title" },
                { name: "type", label: "Type", options: ["note", "link", "file", "video"].map((v) => ({ value: v, label: v })) },
                { name: "content", label: "Content / URL", type: "textarea", required: false },
                { name: "weekNumber", label: "Week (0 = general)", type: "number", value: "0", required: false },
              ]}
            />
            <AcademicSimpleForm
              title="Post an announcement"
              kind="announcement"
              fields={[
                { name: "batchId", label: "Batch", options: batches },
                { name: "title", label: "Title" },
                { name: "body", label: "Message", type: "textarea" },
              ]}
            />
            <AssignmentBuilderForm batches={batches} />
            <AcademicSimpleForm
              title="Queue a daily practice question"
              kind="dailyQuestionCreate"
              description="MCQ auto-grades the same way assignment MCQs do; programming answers are stored for your review. Released to students once the scheduled date arrives."
              fields={[
                { name: "batchId", label: "Batch", options: batches },
                { name: "type", label: "Type", options: [{ value: "mcq", label: "Multiple choice" }, { value: "program", label: "Programming" }] },
                { name: "questionText", label: "Question", type: "textarea" },
                { name: "points", label: "Points", type: "number", value: "10" },
                { name: "scheduledDate", label: "Release date", type: "date" },
                { name: "language", label: "Language (programming only)", required: false },
                { name: "starterCode", label: "Starter code (programming only)", type: "textarea", required: false },
              ]}
            />
          </div>
        )}

        <section>
          <h2 className="mb-3 text-lg font-semibold">Assignments</h2>
          <DataTable
            columns={["Title", "Batch", "Due", "Submissions", "Max points"]}
            rows={d.assignments.map((a) => [
              String(a.title),
              String(a.batch),
              String(a.due_date).slice(0, 16).replace("T", " "),
              `${a.submission_count} / ${a.enrolled_count}`,
              String(a.max_points),
            ])}
          />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Submissions to grade</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Assignment</th>
                  <th>Submitted</th>
                  <th>Auto score</th>
                  <th>Status</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {d.submissions.map((s) => (
                  <tr key={String(s.id)}>
                    <td>{String(s.student)}</td>
                    <td>{String(s.assignment)}</td>
                    <td>{String(s.submitted_at).slice(0, 16).replace("T", " ")}</td>
                    <td>{s.auto_score !== null ? `${s.auto_score} / ${s.max_points}` : "—"}</td>
                    <td>{String(s.status)}</td>
                    <td><GradeForm submissionId={String(s.id)} maxPoints={Number(s.max_points)} currentGrade={s.grade === null ? null : Number(s.grade)} /></td>
                  </tr>
                ))}
                {!d.submissions.length && (
                  <tr><td colSpan={6} className="py-10 text-center text-slate-500">No submissions yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Course materials</h2>
          <DataTable columns={["Title", "Batch", "Type", "Week"]} rows={d.materials.map((m) => [String(m.title), String(m.batch), String(m.type), String(m.week_number)])} />
        </section>
      </div>
    </AppShell>
  );
}
