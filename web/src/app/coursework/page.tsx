import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { DataTable } from "@/components/DataTable";
import { academicLearnData } from "@/lib/academicWorkspace";

export default async function CourseworkPage() {
  const d = await academicLearnData();
  const submissionByAssignment = new Map(d.mySubmissions.map((s) => [String(s.assignment_id), s]));
  const answeredDaily = new Set(d.myDailyAnswers.map((a) => String(a.question_id)));

  return (
    <AppShell breadcrumb="My coursework">
      <div className="mx-auto max-w-5xl space-y-7 px-6 py-8">
        <header>
          <p className="eyebrow">YOUR PROGRAMME</p>
          <h1 className="mt-3 text-3xl font-semibold">Coursework, not just billing.</h1>
          <p className="mt-3 text-sm text-slate-500">Materials, assignments and daily practice for the batches you&apos;re enrolled in.</p>
        </header>

        {d.enrollments.length === 0 && (
          <div className="panel text-sm text-slate-500">You&apos;re not enrolled in any batch yet.</div>
        )}

        <section>
          <h2 className="mb-3 text-lg font-semibold">Assignments</h2>
          <div className="grid gap-3 sm:hidden">
            {d.assignments.map((a) => {
              const sub = submissionByAssignment.get(String(a.id));
              return (
                <div key={String(a.id)} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">{String(a.title)}</span>
                    <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                      {sub ? (sub.status === "graded" ? `${sub.grade}/${a.max_points}` : "Submitted") : "Not started"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{String(a.batch)} · Due {String(a.due_date).slice(0, 16).replace("T", " ")}</div>
                  <Link href={`/coursework/assignments/${a.id}`} className="text-xs font-medium text-blue-700">
                    {sub ? "View / resubmit →" : "Take assignment →"}
                  </Link>
                </div>
              );
            })}
            {!d.assignments.length && <div className="rounded-xl border border-slate-200 py-10 text-center text-sm text-slate-500">No assignments yet.</div>}
          </div>
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white sm:block">
            <table className="data-table">
              <thead><tr><th>Title</th><th>Batch</th><th>Due</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {d.assignments.map((a) => {
                  const sub = submissionByAssignment.get(String(a.id));
                  return (
                    <tr key={String(a.id)}>
                      <td>{String(a.title)}</td>
                      <td>{String(a.batch)}</td>
                      <td>{String(a.due_date).slice(0, 16).replace("T", " ")}</td>
                      <td>{sub ? (sub.status === "graded" ? `Graded: ${sub.grade}/${a.max_points}` : "Submitted") : "Not started"}</td>
                      <td><Link href={`/coursework/assignments/${a.id}`} className="text-blue-700">{sub ? "View / resubmit" : "Take"} →</Link></td>
                    </tr>
                  );
                })}
                {!d.assignments.length && <tr><td colSpan={5} className="py-10 text-center text-slate-500">No assignments yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {d.dailyQuestions.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">Daily practice</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {d.dailyQuestions.map((q) => (
                <div key={String(q.id)} className="panel">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{String(q.type)}</span>
                    {answeredDaily.has(String(q.id)) && <span className="text-xs font-medium text-green-700">Answered</span>}
                  </div>
                  <p className="mb-3 text-sm text-slate-700">{String(q.question_text)}</p>
                  <Link href={`/coursework/daily/${q.id}`} className="text-xs font-medium text-blue-700">
                    {answeredDaily.has(String(q.id)) ? "Review →" : "Answer →"}
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-semibold">Course materials</h2>
          <DataTable columns={["Title", "Batch", "Type", "Week"]} rows={d.materials.map((m) => [String(m.title), String(m.batch), String(m.type), String(m.week_number)])} />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Announcements</h2>
          <div className="space-y-3">
            {d.announcements.map((a) => (
              <div key={String(a.id)} className="panel">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold">{String(a.title)}</span>
                  <span className="text-xs text-slate-400">{String(a.batch)}</span>
                </div>
                <p className="text-sm text-slate-600">{String(a.body)}</p>
              </div>
            ))}
            {!d.announcements.length && <div className="panel text-sm text-slate-500">No announcements yet.</div>}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
