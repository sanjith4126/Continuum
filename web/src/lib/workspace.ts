import { sql } from "drizzle-orm";
import { authorizedTransaction } from "./transaction";
export async function crmData(){return authorizedTransaction("crm",async tx=>{
 const leads=await tx.execute(sql`select e.id,p.name,p.email,p.phone,e.stage,e.source,e.created_at::text from enquiry e join party p on p.id=e.party_id order by e.created_at desc limit 250`);
 const activities=await tx.execute(sql`select a.id,p.name,a.kind,a.note,a.occurred_at::text from activity a left join party p on p.id=a.party_id order by a.occurred_at desc limit 50`);
 const quotations=await tx.execute(sql`select q.id,p.name,q.amount,q.status from quotation q join party p on p.id=q.party_id order by q.created_at desc limit 50`);
 return {leads:leads.rows,activities:activities.rows,quotations:quotations.rows};
});}
export async function trainingData(){return authorizedTransaction("training",async(tx,user)=>{
 const batches=await tx.execute(sql`select b.id,b.name,b.status,b.location,b.starts_on::text,b.ends_on::text,c.title,p.name as trainer from batch b join course c on c.id=b.course_id left join party p on p.id=b.trainer_id where (${user.role}<>'trainer' or b.trainer_id=${user.partyId}::uuid) order by b.created_at desc limit 250`);
 const enrollments=await tx.execute(sql`select e.id,b.name as batch,p.name as student,e.status from enrollment e join batch b on b.id=e.batch_id join party p on p.id=e.student_id order by e.enrolled_at desc limit 250`);
 const attendance=await tx.execute(sql`select a.id,p.name as student,b.name as batch,a.session_date::text,a.present from attendance a join enrollment e on e.id=a.enrollment_id join party p on p.id=e.student_id join batch b on b.id=e.batch_id order by a.session_date desc limit 100`);
 const courses=user.role==="trainer"?[]:(await tx.execute(sql`select id,title as name from course order by title`)).rows;
 const parties=user.role==="trainer"?[]:(await tx.execute(sql`select id,name,roles from party where 'student'=any(roles) or 'trainer'=any(roles) order by name`)).rows;
 const leads=user.role==="trainer"?[]:(await tx.execute(sql`select e.id,p.name from enquiry e join party p on p.id=e.party_id where e.stage='won' order by p.name`)).rows;
 return {batches:batches.rows,enrollments:enrollments.rows,attendance:attendance.rows,courses,parties,leads};
});}
export async function financeData(){return authorizedTransaction("finance",async tx=>{
 const invoices=await tx.execute(sql`select i.id,p.name,b.name as batch,i.status,i.gst_rate,
 coalesce((select sum(amount-discount) from invoice_line where invoice_id=i.id),0) as amount,
 coalesce((select sum(amount) from payment where invoice_id=i.id and paid_at is not null),0) as paid
 from invoice i join party p on p.id=i.party_id left join batch b on b.id=i.batch_id order by i.issued_at desc limit 250`);
 const payments=await tx.execute(sql`select p.id,i.id as invoice_id,b.name as batch,p.amount,p.due_on::text,p.paid_at::text,p.method,
 coalesce((select sum((-le.amount)::numeric) from ledger_event le where le.event_type='payment.refunded' and le.payload->>'originalPaymentId'=p.id::text),0) as refunded
 from payment p join invoice i on i.id=p.invoice_id left join batch b on b.id=i.batch_id order by p.paid_at nulls first,p.due_on limit 250`);
 const batches=await tx.execute(sql`select id,name from batch order by name`);
 const parties=await tx.execute(sql`select id,name,roles from party order by name`);
 return {invoices:invoices.rows,payments:payments.rows,batches:batches.rows,parties:parties.rows};
});}
export function options(rows:Record<string,unknown>[],label="name"){return rows.map(r=>({value:String(r.id),label:String(r[label]??r.id)}));}
