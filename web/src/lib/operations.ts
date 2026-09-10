"use server";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { authorizedTransaction } from "./transaction";
import { requireMoney,requireOneOf,requireOptionalText,requireText,requireUuid,isDate } from "./validation";
import { createLead,convertLead,createBatch,enrollStudent,raiseInvoice,recordPayment,recordExpense,recordTrainerPayment } from "./actions";
import type { Permission } from "./permissions";
export type FormResult={ok:boolean;message:string};
const groups:Record<string,Permission>={lead:"crm",convert:"crm",activity:"crm",quotation:"crm",agreement:"crm",leadEdit:"crm",party:"training",course:"training",batch:"training",enroll:"training",attendance:"training",batchStatus:"training",batchEdit:"trainingWrite",invoice:"finance",payment:"finance",settle:"finance",expense:"finance",trainerPayment:"finance",refund:"finance"};
export async function submitOperation(_previous:FormResult,form:FormData):Promise<FormResult>{
 const get=(key:string)=>String(form.get(key)??"").trim();
 const kind=get("kind");if(!Object.hasOwn(groups,kind))return {ok:false,message:"Unknown operation."};
 const requestId=get("requestId");requireUuid(requestId,"request ID");
 const result=await authorizedTransaction(groups[kind],async(tx,user)=>{
  if(user.role==="trainer"&&kind!=="attendance")return {ok:false,message:"Only operations staff can change training setup."};
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${user.id+requestId},0))`);
  const previous=await tx.execute(sql`select result from operation_request where user_id=${user.id}::uuid and request_id=${requestId}::uuid`);
  if(previous.rows[0])return previous.rows[0].result as FormResult;
  async function event(type:string,entity:string,id:string,batchId:string|null=null,payload:Record<string,unknown>={},amount:string|null=null){
   await tx.execute(sql`insert into ledger_event(actor_id,event_type,entity_type,entity_id,batch_id,payload,amount) values(${user.id}::uuid,${type}::event_type,${entity},${id}::uuid,${batchId}::uuid,${JSON.stringify(payload)}::jsonb,${amount}::numeric)`);
  }
  const uuid=(key:string)=>{const v=get(key);requireUuid(v,key);return v;};
  const text=(key:string,max=200)=>{const v=get(key);requireText(v,key,max);return v;};
  const money=(key:string)=>{const v=get(key);requireMoney(v,key);return v;};
  switch(kind){
   case "lead":{
    const partyKind=get("partyKind");requireOneOf(partyKind,"party kind",["person","org"] as const);
    await createLead({name:text("name"),kind:partyKind,email:get("email"),phone:get("phone"),source:get("source")});break;
   }
   case "convert": await convertLead({enquiryId:uuid("enquiryId")});break;
   case "leadEdit":{
    const id=uuid("enquiryId");
    const found=await tx.execute(sql`select party_id from enquiry where id=${id}::uuid for update`);
    if(!found.rows[0])throw new Error("Lead not found.");
    const partyId=String(found.rows[0].party_id);
    const name=text("name");const email=get("email");const phone=get("phone");const source=get("source");
    requireOptionalText(email,"email",254);requireOptionalText(phone,"phone",50);requireOptionalText(source,"source",100);
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("Invalid email.");
    await tx.execute(sql`update party set name=${name},email=${email||null},phone=${phone||null} where id=${partyId}::uuid`);
    await tx.execute(sql`update enquiry set source=${source||null} where id=${id}::uuid`);
    await event("lead.updated","enquiry",id,null,{name,email:email||null,phone:phone||null,source:source||null});
    break;
   }
   case "activity":case "agreement":case "quotation":{
    const id=uuid("enquiryId");const found=await tx.execute(sql`select party_id from enquiry where id=${id}::uuid for update`);if(!found.rows[0])throw new Error("Lead not found.");const partyId=String(found.rows[0].party_id);
    if(kind==="quotation"){
     const amount=money("amount");const rows=await tx.execute(sql`insert into quotation(enquiry_id,party_id,amount) values(${id}::uuid,${partyId}::uuid,${amount}) returning id`);
     await event("quotation.sent","quotation",String(rows.rows[0].id),null,{enquiryId:id,amount});
     await tx.execute(sql`update enquiry set stage='quoted' where id=${id}::uuid`);
    }else{
     const note=text("note",4000);const activityKind=kind==="agreement"?"agreement":get("activityKind");if(!["agreement","call","email","note","meeting"].includes(activityKind))throw new Error("Invalid activity type.");
     const rows=await tx.execute(sql`insert into activity(enquiry_id,party_id,kind,note,owner_id) values(${id}::uuid,${partyId}::uuid,${activityKind},${note},${user.id}::uuid) returning id`);
     await event(kind==="agreement"?"agreement.signed":"lead.contacted","enquiry",id,null,{activityId:rows.rows[0].id,kind:activityKind,note});
     if(kind==="activity")await tx.execute(sql`update enquiry set stage='contacted' where id=${id}::uuid and stage='new'`);
    }break;
   }
   case "party":{
    const role=get("partyRole");if(!["student","trainer","corporate_buyer"].includes(role))throw new Error("Invalid profile role.");
    const name=text("name");const email=get("email");const phone=get("phone");requireOptionalText(email,"email",254);requireOptionalText(phone,"phone",50);if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("Invalid email.");
    const rows=await tx.execute(sql`insert into party(name,kind,email,phone,roles) values(${name},${role==="corporate_buyer"?"org":"person"},${email||null},${phone||null},array[${role}]) returning id`);await event("party.created","party",String(rows.rows[0].id),null,{role});break;
   }
   case "course":{
    const title=text("title");const amount=money("amount");const rows=await tx.execute(sql`insert into course(title,default_price) values(${title},${amount}) returning id`);await event("course.created","course",String(rows.rows[0].id));break;
   }
   case "batch": await createBatch({courseId:uuid("courseId"),name:text("name"),sourceLeadId:get("enquiryId")||undefined,trainerId:get("trainerId")||undefined,location:get("location"),startsOn:get("startsOn")||undefined,endsOn:get("endsOn")||undefined});break;
   case "enroll": await enrollStudent({batchId:uuid("batchId"),studentId:uuid("studentId")});break;
   case "batchEdit":{
    const id=uuid("batchId");
    const name=text("name");const location=get("location");requireOptionalText(location,"location",200);
    const startsOn=get("startsOn")||null;const endsOn=get("endsOn")||null;
    if(startsOn&&!isDate(startsOn))throw new Error("Invalid start date.");
    if(endsOn&&!isDate(endsOn))throw new Error("Invalid end date.");
    if(startsOn&&endsOn&&endsOn<startsOn)throw new Error("End date must follow start date.");
    const changed=await tx.execute(sql`update batch set name=${name},location=${location||null},starts_on=${startsOn}::date,ends_on=${endsOn}::date where id=${id}::uuid returning id`);
    if(!changed.rows.length)throw new Error("Batch not found.");
    await event("batch.details_updated","batch",id,id,{name,location:location||null,startsOn,endsOn});
    break;
   }
   case "batchStatus":{
    const id=uuid("batchId"),status=get("status");if(!["planned","running","completed","cancelled"].includes(status))throw new Error("Invalid status.");
    const changed=await tx.execute(sql`update batch set status=${status}::batch_status where id=${id}::uuid returning id`);if(!changed.rows.length)throw new Error("Batch not found.");await event("batch.updated","batch",id,id,{status});break;
   }
   case "attendance":{
    const id=uuid("enrollmentId"),date=get("sessionDate");if(!isDate(date)||date>new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"}))throw new Error("Attendance requires a valid date no later than today.");
    const enrollment=await tx.execute(sql`select e.batch_id,b.trainer_id from enrollment e join batch b on b.id=e.batch_id where e.id=${id}::uuid for update of e`);
    if(!enrollment.rows[0]||(user.role==="trainer"&&enrollment.rows[0].trainer_id!==user.partyId))throw new Error("Enrollment is not assigned to you.");
    const present=get("present")==="true";
    const rows=await tx.execute(sql`insert into attendance(enrollment_id,session_date,present) values(${id}::uuid,${date}::date,${present})
      on conflict(enrollment_id,session_date) do update set present=excluded.present returning id`);
    const attendanceId=String(rows.rows[0].id);
    await event("attendance.marked","attendance",attendanceId,String(enrollment.rows[0].batch_id),{date,present});break;
   }
   case "invoice":{
    const batchId=uuid("batchId"),amount=money("amount"),dueOn=get("dueOn");if(!isDate(dueOn))throw new Error("Choose an installment due date.");
    const description=get("description");requireOptionalText(description,"invoice description",500);
    const inv=await raiseInvoice({partyId:uuid("partyId"),batchId,amount,description,gstRate:get("gstRate")||"18"});
    await recordPayment({invoiceId:inv.invoiceId,batchId,amount,paid:false,dueOn});break;
   }
   case "payment":{
    const invoiceId=uuid("invoiceId");const rows=await tx.execute(sql`select batch_id from invoice where id=${invoiceId}::uuid`);if(!rows.rows[0])throw new Error("Invoice not found.");
    const method=get("method")||"bank";requireOneOf(method,"payment method",["bank","upi","card","cash"] as const);
    await recordPayment({invoiceId,batchId:String(rows.rows[0].batch_id),amount:money("amount"),method,paid:true});break;
   }
   case "settle":{
    const id=uuid("paymentId");const found=await tx.execute(sql`select invoice_id from payment where id=${id}::uuid`);if(!found.rows[0])throw new Error("Installment not found.");const invoiceId=String(found.rows[0].invoice_id);
    await tx.execute(sql`select id from invoice where id=${invoiceId}::uuid for update`);
    const method=get("method")||"bank";requireOneOf(method,"payment method",["bank","upi","card","cash"] as const);
    const rows=await tx.execute(sql`update payment set paid_at=now(),method=${method} where id=${id}::uuid and paid_at is null returning amount`);
    if(rows.rows.length){const inv=await tx.execute(sql`select batch_id from invoice where id=${invoiceId}::uuid`);await event("payment.settled","payment",id,String(inv.rows[0].batch_id),{amount:rows.rows[0].amount});
     await tx.execute(sql`update invoice set status=case
      when (select coalesce(sum(amount),0) from payment where invoice_id=${invoiceId}::uuid and paid_at is not null)>=(select coalesce(sum(amount-discount),0) from invoice_line where invoice_id=${invoiceId}::uuid) then 'paid'::invoice_status
      when (select coalesce(sum(amount),0) from payment where invoice_id=${invoiceId}::uuid and paid_at is not null)>0 then 'part_paid'::invoice_status
      else 'issued'::invoice_status end where id=${invoiceId}::uuid`);
    }break;
   }
   case "refund":{
    const id=uuid("paymentId");
    const amount=money("amount");
    const found=await tx.execute(sql`select p.invoice_id,p.amount as paid_amount,i.batch_id from payment p join invoice i on i.id=p.invoice_id where p.id=${id}::uuid and p.paid_at is not null for update of p`);
    if(!found.rows[0])throw new Error("This installment has not been received, so it cannot be refunded.");
    const invoiceId=String(found.rows[0].invoice_id);const batchId=String(found.rows[0].batch_id);
    // Already-refunded amount against this specific payment, read from the
    // ledger (the actual source of truth for "which original payment does
    // this refund event belong to"), so a payment can only ever be
    // refunded up to what was actually collected on it -- never more, and
    // a retried/duplicate refund can't double-count.
    const already=await tx.execute(sql`select coalesce(sum((-amount)),0) as refunded from ledger_event where event_type='payment.refunded' and payload->>'originalPaymentId'=${id}`);
    const refundedSoFar=Number(already.rows[0].refunded);
    const paidAmount=Number(found.rows[0].paid_amount);
    if(refundedSoFar+Number(amount)>paidAmount+0.001)throw new Error("This exceeds what was actually collected on this installment.");
    const rows=await tx.execute(sql`insert into payment(invoice_id,amount,method,paid_at) values(${invoiceId}::uuid,${"-"+amount},'refund',now()) returning id`);
    await event("payment.refunded","payment",String(rows.rows[0].id),batchId,{amount,originalPaymentId:id},"-"+amount);
    await tx.execute(sql`update invoice set status=case
      when (select coalesce(sum(amount),0) from payment where invoice_id=${invoiceId}::uuid and paid_at is not null)
        >= (select coalesce(sum(amount-discount),0) from invoice_line where invoice_id=${invoiceId}::uuid)
      then 'paid'::invoice_status
      when (select coalesce(sum(amount),0) from payment where invoice_id=${invoiceId}::uuid and paid_at is not null) > 0
      then 'part_paid'::invoice_status else 'issued'::invoice_status end where id=${invoiceId}::uuid`);
    break;
   }
   case "expense":{
    const category=get("category");requireOneOf(category,"expense category",["trainer_fee","venue","travel","materials","marketing","other"] as const);
    const vendor=get("vendor");requireOptionalText(vendor,"vendor",200);
    await recordExpense({batchId:uuid("batchId"),amount:money("amount"),category,vendor});break;
   }
   case "trainerPayment": await recordTrainerPayment({batchId:uuid("batchId"),trainerId:uuid("trainerId"),amount:money("amount")});break;
  }
  const result={ok:true,message:"Saved successfully."};
  await tx.execute(sql`insert into operation_request(user_id,request_id,result) values(${user.id}::uuid,${requestId}::uuid,${JSON.stringify(result)}::jsonb)`);
  return result;
 }).catch((error:unknown)=>{
  // Preserve Next's authorization redirects instead of swallowing them as form errors.
  if(error&&typeof error==="object"&&"digest" in error)throw error;
  const message=error instanceof Error?error.message:"Unable to save.";
  return {ok:false,message:/failed query|duplicate key|violates|permission denied/i.test(message)?"Unable to save. Check for duplicate records and verify the selected values.":message};
 });
 if(result.ok)for(const path of ["/crm","/training","/finance","/collections","/dashboard"])revalidatePath(path);
 return result;
}
