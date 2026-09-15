import { sql } from "drizzle-orm";
import { authorizedTransaction } from "./transaction";

// Data-fetch layer for the academic (course/assignment/grading) pages,
// mirroring workspace.ts's pattern. Trainers only ever see their own
// assigned batches -- the same restriction trainingData() already applies
// -- ops/management see everything.

// Drizzle's `sql` template serializes a plain JS array parameter as a
// Postgres ROW/record literal, not an array literal -- `= any($1::uuid[])`
// then fails with "cannot cast type record to uuid[]". Building an
// explicit comma-joined list of ${id}::uuid fragments and using `in (...)`
// sidesteps that; verified directly against the live database before use.
function idList(ids: string[]) {
  return sql.join(ids.map((id) => sql`${id}::uuid`), sql`,`);
}

export async function academicTeachData() {
  return authorizedTransaction("academicTeach", async (tx, user) => {
    const scopedBatches = await tx.execute(sql`
      select b.id, b.name, c.title as course_title, p.name as trainer
      from batch b join course c on c.id=b.course_id left join party p on p.id=b.trainer_id
      where (${user.role}<>'trainer' or b.trainer_id=${user.partyId}::uuid)
      order by b.created_at desc limit 100`);
    const batches = scopedBatches.rows;
    const batchIds = batches.map((b) => String(b.id));
    if (batchIds.length === 0) {
      return { batches: [], materials: [], assignments: [], dailyQuestions: [], announcements: [], submissions: [] };
    }
    const materials = await tx.execute(sql`
      select m.id, m.title, m.type, m.week_number, b.name as batch, m.created_at::text
      from course_material m join batch b on b.id=m.batch_id
      where m.batch_id in (${idList(batchIds)}) order by m.week_number, m.created_at desc limit 200`);
    const assignments = await tx.execute(sql`
      select a.id, a.title, a.due_date::text, a.max_points, a.week_number, b.name as batch,
      (select count(*) from assignment_submission s where s.assignment_id=a.id) as submission_count,
      (select count(*) from enrollment e where e.batch_id=a.batch_id) as enrolled_count
      from assignment a join batch b on b.id=a.batch_id
      where a.batch_id in (${idList(batchIds)}) order by a.due_date desc limit 200`);
    const dailyQuestions = await tx.execute(sql`
      select q.id, q.question_text, q.type, q.scheduled_date::text, b.name as batch
      from daily_question q join batch b on b.id=q.batch_id
      where q.batch_id in (${idList(batchIds)}) order by q.scheduled_date desc limit 100`);
    const announcements = await tx.execute(sql`
      select a.id, a.title, a.body, b.name as batch, a.created_at::text
      from announcement a join batch b on b.id=a.batch_id
      where a.batch_id in (${idList(batchIds)}) order by a.created_at desc limit 100`);
    const submissions = await tx.execute(sql`
      select s.id, a.title as assignment, p.name as student, s.status, s.grade, s.auto_score, a.max_points,
      s.submitted_at::text, a.id as assignment_id
      from assignment_submission s
      join assignment a on a.id=s.assignment_id
      join enrollment e on e.id=s.enrollment_id
      join party p on p.id=e.student_id
      where a.batch_id in (${idList(batchIds)}) order by s.submitted_at desc limit 200`);
    return {
      batches,
      materials: materials.rows,
      assignments: assignments.rows,
      dailyQuestions: dailyQuestions.rows,
      announcements: announcements.rows,
      submissions: submissions.rows,
    };
  });
}

export async function academicLearnData() {
  return authorizedTransaction("academicLearn", async (tx, user) => {
    const enrollments = await tx.execute(sql`
      select e.id as enrollment_id, b.id as batch_id, b.name as batch, c.title as course_title, b.status
      from enrollment e join batch b on b.id=e.batch_id join course c on c.id=b.course_id
      where e.student_id=${user.partyId}::uuid order by b.created_at desc`);
    const batchIds = enrollments.rows.map((r) => String(r.batch_id));
    if (batchIds.length === 0) {
      return { enrollments: [], materials: [], assignments: [], mySubmissions: [], dailyQuestions: [], myDailyAnswers: [], announcements: [] };
    }
    const materials = await tx.execute(sql`
      select m.id, m.title, m.type, m.content, m.file_path, m.week_number, b.name as batch
      from course_material m join batch b on b.id=m.batch_id
      where m.batch_id in (${idList(batchIds)}) order by m.week_number, m.created_at`);
    const assignments = await tx.execute(sql`
      select a.id, a.title, a.description, a.due_date::text, a.max_points, a.week_number, b.name as batch, a.batch_id
      from assignment a join batch b on b.id=a.batch_id
      where a.batch_id in (${idList(batchIds)}) order by a.due_date`);
    const mySubmissions = await tx.execute(sql`
      select s.id, s.assignment_id, s.status, s.grade, s.auto_score, s.feedback, s.submitted_at::text
      from assignment_submission s join enrollment e on e.id=s.enrollment_id
      where e.student_id=${user.partyId}::uuid`);
    const dailyQuestions = await tx.execute(sql`
      select q.id, q.question_text, q.type, q.points, q.scheduled_date::text, q.batch_id, b.name as batch
      from daily_question q join batch b on b.id=q.batch_id
      where q.batch_id in (${idList(batchIds)}) and q.scheduled_date <= current_date
      order by q.scheduled_date, q.position`);
    const myDailyAnswers = await tx.execute(sql`
      select da.question_id, da.is_correct, da.points_awarded
      from daily_answer da join enrollment e on e.id=da.enrollment_id
      where e.student_id=${user.partyId}::uuid`);
    const announcements = await tx.execute(sql`
      select a.id, a.title, a.body, b.name as batch, a.created_at::text
      from announcement a join batch b on b.id=a.batch_id
      where a.batch_id in (${idList(batchIds)}) order by a.created_at desc limit 50`);
    return {
      enrollments: enrollments.rows,
      materials: materials.rows,
      assignments: assignments.rows,
      mySubmissions: mySubmissions.rows,
      dailyQuestions: dailyQuestions.rows,
      myDailyAnswers: myDailyAnswers.rows,
      announcements: announcements.rows,
    };
  });
}

// One assignment's full question set, for the taking-page and the
// grading-review page. `forStudent` strips is_correct/is_correct-bearing
// fields the way the original LMS's per-question review page did --
// students never receive which option was correct in the page data.
export async function assignmentDetail(assignmentId: string, forStudent: boolean) {
  return authorizedTransaction(forStudent ? "academicLearn" : "academicTeach", async (tx) => {
    const assignment = await tx.execute(sql`select a.*, b.name as batch_name from assignment a join batch b on b.id=a.batch_id where a.id=${assignmentId}::uuid`);
    const questions = await tx.execute(sql`select * from assignment_question where assignment_id=${assignmentId}::uuid order by position`);
    const questionIds = questions.rows.map((q) => String(q.id));
    const options = questionIds.length
      ? (await tx.execute(sql`select * from assignment_question_option where question_id in (${idList(questionIds)}) order by position`)).rows
      : [];
    const testCases = questionIds.length
      ? (await tx.execute(sql`select * from assignment_question_test_case where question_id in (${idList(questionIds)}) order by position`)).rows
      : [];
    return {
      assignment: assignment.rows[0] ?? null,
      questions: questions.rows.map((qRow) => {
        const q = qRow as Record<string, unknown> & { id: unknown; type: unknown; question_text: unknown; points: unknown; language: unknown; starter_code: unknown };
        return {
        id: q.id,
        type: q.type,
        question_text: q.question_text,
        points: q.points,
        language: q.language,
        starter_code: q.starter_code,
        options: options
          .filter((o) => String(o.question_id) === String(q.id))
          .map((o) => (forStudent ? { id: o.id, option_text: o.option_text, position: o.position } : o)),
        testCases: testCases.filter((t) => String(t.question_id) === String(q.id)),
        };
      }),
    };
  });
}

export function options(rows: Record<string, unknown>[], label = "name") {
  return rows.map((r) => ({ value: String(r.id), label: String(r[label] ?? r.id) }));
}
