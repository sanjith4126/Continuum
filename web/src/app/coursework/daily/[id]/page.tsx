import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DailyAnswerForm } from "@/components/DailyAnswerForm";
import { authorizedTransaction } from "@/lib/transaction";
import { sql } from "drizzle-orm";

async function dailyQuestionDetail(id: string) {
  return authorizedTransaction("academicLearn", async (tx, user) => {
    const q = await tx.execute(sql`select dq.*, b.name as batch_name from daily_question dq join batch b on b.id=dq.batch_id where dq.id=${id}::uuid`);
    if (!q.rows[0]) return null;
    const options = await tx.execute(sql`select id,option_text from daily_question_option where question_id=${id}::uuid order by position`);
    const myAnswer = await tx.execute(sql`
      select da.* from daily_answer da join enrollment e on e.id=da.enrollment_id
      where da.question_id=${id}::uuid and e.student_id=${user.partyId}::uuid`);
    const mySelections = myAnswer.rows[0]
      ? (await tx.execute(sql`select option_id from daily_answer_selection where answer_id=${myAnswer.rows[0].id}::uuid`)).rows.map((r) => String(r.option_id))
      : [];
    return { question: q.rows[0], options: options.rows, myAnswer: myAnswer.rows[0] ?? null, mySelections };
  });
}

export default async function DailyQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await dailyQuestionDetail(id);
  if (!detail) notFound();

  return (
    <AppShell breadcrumb="Daily practice">
      <div className="mx-auto max-w-2xl space-y-6 px-6 py-8">
        <header>
          <p className="eyebrow">{String(detail.question.batch_name)} · Daily practice</p>
          <h1 className="mt-3 text-xl font-semibold">{String(detail.question.question_text)}</h1>
        </header>
        <DailyAnswerForm
          questionId={id}
          type={detail.question.type as "mcq" | "program"}
          options={detail.options.map((o) => ({ id: String(o.id), text: String(o.option_text) }))}
          starterCode={detail.question.starter_code as string | null}
          existingSelections={detail.mySelections}
          existingCode={detail.myAnswer ? String(detail.myAnswer.code_answer ?? "") : ""}
          alreadyAnswered={!!detail.myAnswer}
          isCorrect={detail.myAnswer ? (detail.myAnswer.is_correct as boolean | null) : null}
        />
      </div>
    </AppShell>
  );
}
