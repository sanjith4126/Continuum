"use server";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { authorizedTransaction } from "./transaction";
import { requireOneOf, requireText, requireUuid, isDate } from "./validation";
import type { Permission } from "./permissions";

export type FormResult = { ok: boolean; message: string };

type QuestionInput = {
  type: "mcq" | "program";
  questionText: string;
  points: number;
  language?: string;
  starterCode?: string;
  options?: { text: string; correct: boolean }[];
  testCases?: { input: string; expectedOutput: string }[];
};

const groups: Record<string, Permission> = {
  material: "academicTeach",
  announcement: "academicTeach",
  assignmentCreate: "academicTeach",
  dailyQuestionCreate: "academicTeach",
  grade: "academicTeach",
  submitAssignment: "academicLearn",
  answerDaily: "academicLearn",
};

export async function submitAcademicOperation(_previous: FormResult, form: FormData): Promise<FormResult> {
  const get = (key: string) => String(form.get(key) ?? "").trim();
  const kind = get("kind");
  if (!Object.hasOwn(groups, kind)) return { ok: false, message: "Unknown operation." };
  const requestId = get("requestId");
  requireUuid(requestId, "request ID");

  const result = await authorizedTransaction(groups[kind], async (tx, user) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${user.id + requestId}, 0))`);
    const previous = await tx.execute(
      sql`select result from operation_request where user_id=${user.id}::uuid and request_id=${requestId}::uuid`
    );
    if (previous.rows[0]) return previous.rows[0].result as FormResult;

    async function event(type: string, entity: string, id: string, batchId: string | null = null, payload: Record<string, unknown> = {}) {
      await tx.execute(
        sql`insert into ledger_event(actor_id,event_type,entity_type,entity_id,batch_id,payload) values(${user.id}::uuid,${type}::event_type,${entity},${id}::uuid,${batchId}::uuid,${JSON.stringify(payload)}::jsonb)`
      );
    }
    const uuid = (key: string) => {
      const v = get(key);
      requireUuid(v, key);
      return v;
    };
    const text = (key: string, max = 200) => {
      const v = get(key);
      requireText(v, key, max);
      return v;
    };

    switch (kind) {
      case "material": {
        const batchId = uuid("batchId");
        const title = text("title");
        const type = get("type");
        requireOneOf(type, "material type", ["note", "link", "file", "video"] as const);
        const content = get("content") || null;
        const weekNumber = Number(get("weekNumber") || "0");
        const row = await tx.execute(
          sql`insert into course_material(batch_id,title,type,content,week_number,uploaded_by) values(${batchId}::uuid,${title},${type}::material_type,${content},${weekNumber},${user.id}::uuid) returning id`
        );
        await event("material.posted", "course_material", String(row.rows[0].id), batchId, { title });
        break;
      }
      case "announcement": {
        const batchId = uuid("batchId");
        const title = text("title");
        const body = text("body", 4000);
        const row = await tx.execute(
          sql`insert into announcement(batch_id,title,body,posted_by) values(${batchId}::uuid,${title},${body},${user.id}::uuid) returning id`
        );
        await event("announcement.posted", "announcement", String(row.rows[0].id), batchId, { title });
        break;
      }
      case "assignmentCreate": {
        const batchId = uuid("batchId");
        const title = text("title");
        const description = get("description") || null;
        const dueDate = get("dueDate");
        if (!dueDate) throw new Error("Due date is required.");
        const maxPoints = Number(get("maxPoints") || "100");
        const weekNumber = Number(get("weekNumber") || "0");
        const questionsJson = get("questionsJson");
        let questions: QuestionInput[] = [];
        if (questionsJson) {
          try {
            questions = JSON.parse(questionsJson);
          } catch {
            throw new Error("Invalid question data.");
          }
        }
        const row = await tx.execute(
          sql`insert into assignment(batch_id,title,description,due_date,max_points,week_number,created_by) values(${batchId}::uuid,${title},${description},${dueDate}::timestamptz,${maxPoints},${weekNumber},${user.id}::uuid) returning id`
        );
        const assignmentId = String(row.rows[0].id);
        for (let qi = 0; qi < questions.length; qi++) {
          const q = questions[qi];
          if (!q.questionText || !q.questionText.trim()) continue;
          const qRow = await tx.execute(
            sql`insert into assignment_question(assignment_id,type,position,question_text,points,language,starter_code) values(${assignmentId}::uuid,${q.type}::question_type,${qi},${q.questionText},${q.points || 10},${q.language || null},${q.starterCode || null}) returning id`
          );
          const questionId = String(qRow.rows[0].id);
          if (q.type === "mcq" && q.options) {
            for (let oi = 0; oi < q.options.length; oi++) {
              const o = q.options[oi];
              if (!o.text || !o.text.trim()) continue;
              await tx.execute(
                sql`insert into assignment_question_option(question_id,option_text,is_correct,position) values(${questionId}::uuid,${o.text},${!!o.correct},${oi})`
              );
            }
          }
          if (q.type === "program" && q.testCases) {
            for (let ti = 0; ti < q.testCases.length; ti++) {
              const t = q.testCases[ti];
              if (!t.input && !t.expectedOutput) continue;
              await tx.execute(
                sql`insert into assignment_question_test_case(question_id,input,expected_output,position) values(${questionId}::uuid,${t.input || ""},${t.expectedOutput || ""},${ti})`
              );
            }
          }
        }
        await event("assignment.created", "assignment", assignmentId, batchId, { title, questionCount: questions.length });
        break;
      }
      case "dailyQuestionCreate": {
        const batchId = uuid("batchId");
        const type = get("type");
        requireOneOf(type, "question type", ["mcq", "program"] as const);
        const questionText = text("questionText", 4000);
        const points = Number(get("points") || "10");
        const scheduledDate = get("scheduledDate");
        if (!isDate(scheduledDate)) throw new Error("Invalid scheduled date.");
        const language = get("language") || null;
        const starterCode = get("starterCode") || null;
        const row = await tx.execute(
          sql`insert into daily_question(batch_id,type,question_text,points,language,starter_code,scheduled_date,created_by) values(${batchId}::uuid,${type}::question_type,${questionText},${points},${language},${starterCode},${scheduledDate}::date,${user.id}::uuid) returning id`
        );
        const questionId = String(row.rows[0].id);
        const optionsJson = get("optionsJson");
        if (type === "mcq" && optionsJson) {
          try {
            const opts: { text: string; correct: boolean }[] = JSON.parse(optionsJson);
            for (let oi = 0; oi < opts.length; oi++) {
              if (!opts[oi].text?.trim()) continue;
              await tx.execute(
                sql`insert into daily_question_option(question_id,option_text,is_correct,position) values(${questionId}::uuid,${opts[oi].text},${!!opts[oi].correct},${oi})`
              );
            }
          } catch {
            /* ignore malformed options, question still created */
          }
        }
        break;
      }
      case "submitAssignment": {
        const assignmentId = uuid("assignmentId");
        const enrollment = await tx.execute(
          sql`select e.id from enrollment e join assignment a on a.batch_id=e.batch_id where a.id=${assignmentId}::uuid and e.student_id=${user.partyId}::uuid`
        );
        if (!enrollment.rows[0]) throw new Error("You are not enrolled in this assignment's batch.");
        const enrollmentId = String(enrollment.rows[0].id);
        const assignmentRow = await tx.execute(sql`select due_date from assignment where id=${assignmentId}::uuid`);
        const dueDate = assignmentRow.rows[0]?.due_date as string | undefined;
        const isLate = dueDate ? new Date() > new Date(dueDate) : false;
        const freeText = get("content") || null;

        const answersJson = get("answersJson");
        let answers: { questionId: string; type: "mcq" | "program"; selectedOptionIds?: string[]; codeAnswer?: string }[] = [];
        if (answersJson) {
          try {
            answers = JSON.parse(answersJson);
          } catch {
            throw new Error("Invalid answer data.");
          }
        }

        const subRow = await tx.execute(
          sql`insert into assignment_submission(assignment_id,enrollment_id,content,status) values(${assignmentId}::uuid,${enrollmentId}::uuid,${freeText},${isLate ? "late" : "submitted"}::submission_status)
          on conflict (assignment_id,enrollment_id) do update set content=excluded.content,submitted_at=now(),status=excluded.status
          returning id`
        );
        const submissionId = String(subRow.rows[0].id);
        // Clear any prior answers on resubmission -- one submission per
        // (assignment, enrollment), answers are always the latest set.
        await tx.execute(sql`delete from assignment_answer where submission_id=${submissionId}::uuid`);

        let autoScore = 0;
        let autoTotal = 0;
        for (const a of answers) {
          const qRow = await tx.execute(sql`select points from assignment_question where id=${a.questionId}::uuid`);
          const points = Number(qRow.rows[0]?.points ?? 0);
          if (a.type === "mcq") {
            autoTotal += points;
            const correctOptions = await tx.execute(
              sql`select id from assignment_question_option where question_id=${a.questionId}::uuid and is_correct=true`
            );
            const correctIds = new Set(correctOptions.rows.map((r) => String(r.id)));
            const selected = new Set(a.selectedOptionIds ?? []);
            const isCorrect = correctIds.size === selected.size && [...correctIds].every((id) => selected.has(id));
            const pointsAwarded = isCorrect ? points : 0;
            autoScore += pointsAwarded;
            const ansRow = await tx.execute(
              sql`insert into assignment_answer(submission_id,question_id,is_correct,points_awarded) values(${submissionId}::uuid,${a.questionId}::uuid,${isCorrect},${pointsAwarded}) returning id`
            );
            const answerId = String(ansRow.rows[0].id);
            for (const optId of selected) {
              await tx.execute(
                sql`insert into assignment_answer_selection(answer_id,option_id) values(${answerId}::uuid,${optId}::uuid) on conflict do nothing`
              );
            }
          } else {
            await tx.execute(
              sql`insert into assignment_answer(submission_id,question_id,code_answer) values(${submissionId}::uuid,${a.questionId}::uuid,${a.codeAnswer || ""})`
            );
          }
        }
        if (autoTotal > 0) {
          await tx.execute(sql`update assignment_submission set auto_score=${autoScore} where id=${submissionId}::uuid`);
        }
        await event("assignment.submitted", "assignment_submission", submissionId, null, { assignmentId, isLate });
        break;
      }
      case "answerDaily": {
        const questionId = uuid("questionId");
        const enrollment = await tx.execute(
          sql`select e.id from enrollment e join daily_question q on q.batch_id=e.batch_id where q.id=${questionId}::uuid and e.student_id=${user.partyId}::uuid`
        );
        if (!enrollment.rows[0]) throw new Error("You are not enrolled in this batch.");
        const enrollmentId = String(enrollment.rows[0].id);
        const type = get("type");
        const questionRow = await tx.execute(sql`select points from daily_question where id=${questionId}::uuid`);
        const points = Number(questionRow.rows[0]?.points ?? 0);
        if (type === "mcq") {
          const selectedJson = get("selectedOptionIds");
          const selected: string[] = selectedJson ? JSON.parse(selectedJson) : [];
          const correctOptions = await tx.execute(
            sql`select id from daily_question_option where question_id=${questionId}::uuid and is_correct=true`
          );
          const correctIds = new Set(correctOptions.rows.map((r) => String(r.id)));
          const selectedSet = new Set(selected);
          const isCorrect = correctIds.size === selectedSet.size && [...correctIds].every((id) => selectedSet.has(id));
          const pointsAwarded = isCorrect ? points : 0;
          const ansRow = await tx.execute(
            sql`insert into daily_answer(question_id,enrollment_id,is_correct,points_awarded) values(${questionId}::uuid,${enrollmentId}::uuid,${isCorrect},${pointsAwarded})
            on conflict (question_id,enrollment_id) do update set is_correct=excluded.is_correct,points_awarded=excluded.points_awarded,answered_at=now()
            returning id`
          );
          const answerId = String(ansRow.rows[0].id);
          await tx.execute(sql`delete from daily_answer_selection where answer_id=${answerId}::uuid`);
          for (const optId of selectedSet) {
            await tx.execute(
              sql`insert into daily_answer_selection(answer_id,option_id) values(${answerId}::uuid,${optId}::uuid) on conflict do nothing`
            );
          }
        } else {
          const codeAnswer = get("codeAnswer") || "";
          await tx.execute(
            sql`insert into daily_answer(question_id,enrollment_id,code_answer) values(${questionId}::uuid,${enrollmentId}::uuid,${codeAnswer})
            on conflict (question_id,enrollment_id) do update set code_answer=excluded.code_answer,answered_at=now()`
          );
        }
        await event("daily_question.answered", "daily_question", questionId, null, {});
        break;
      }
      case "grade": {
        const submissionId = uuid("submissionId");
        const grade = Number(get("grade"));
        if (!Number.isFinite(grade) || grade < 0) throw new Error("Invalid grade.");
        const feedback = get("feedback") || null;
        const changed = await tx.execute(
          sql`update assignment_submission set grade=${grade},feedback=${feedback},status='graded' where id=${submissionId}::uuid returning id,assignment_id`
        );
        if (!changed.rows.length) throw new Error("Submission not found.");
        await event("assignment.graded", "assignment_submission", submissionId, null, { grade });
        break;
      }
      default:
        throw new Error("Unknown operation.");
    }

    await tx.execute(
      sql`insert into operation_request(user_id,request_id,result) values(${user.id}::uuid,${requestId}::uuid,${JSON.stringify({ ok: true, message: "Saved." })}::jsonb)`
    );
    return { ok: true, message: "Saved." };
  }).catch((error: unknown) => {
    // Preserve Next's authorization redirects instead of swallowing them as form errors.
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message = error instanceof Error ? error.message : "Unable to save.";
    return { ok: false, message: /failed query|duplicate key|violates|permission denied/i.test(message) ? "Unable to save. Check the selected values." : message };
  });

  if (result.ok) for (const path of ["/academic", "/coursework"]) revalidatePath(path);
  return result;
}
