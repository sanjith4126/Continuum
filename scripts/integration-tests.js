// Isolated schema integration tests. No business writes to public.
require('dotenv').config({path:'web/.env.local',quiet:true});
const {Client}=require('pg');const fs=require('node:fs');const path=require('node:path');
const {randomUUID,randomBytes,createHash}=require('node:crypto');const assert=require('node:assert/strict');
const ts=require('../web/node_modules/typescript');const Module=require('node:module');
const {verifiedConnectionString}=require('./db-connection');
const schema='qa_'+randomBytes(6).toString('hex');const baseUrl=process.env.DATABASE_URL;
let currentToken='';const results=[];
async function main(){
 const direct=verifiedConnectionString(baseUrl,{direct:true});
 const setup=new Client({connectionString:direct});await setup.connect();
 let appPool;
 try{
  await setup.query(`create schema ${schema}`);await setup.query(`set search_path to ${schema},public`);
  await setup.query(fs.readFileSync('db/schema.sql','utf8'));
  await setup.query(fs.readFileSync('db/seed.sql','utf8'));
  await setup.query(fs.readFileSync('db/migrations/001_production.sql','utf8').replaceAll('schema public',`schema ${schema}`));
  await setup.query(fs.readFileSync('db/migrations/002_features.sql','utf8'));
  await setup.query(fs.readFileSync('db/migrations/003_hardening.sql','utf8'));
  await setup.query(`grant usage on schema ${schema} to continuum_app,continuum_ai,continuum_staff`);
  await setup.query('grant select on enrollment,attendance,invoice,invoice_line,payment,batch,course to continuum_app');
  await setup.query('grant select on batch_pnl,collections_aging,dashboard_kpis to continuum_ai');
  const url=new URL(verifiedConnectionString(baseUrl,{direct:true}));url.searchParams.set('options',`-c search_path=${schema},public`);process.env.DATABASE_URL=url.toString();
  const oldLoad=Module._load;
  Module._load=function(name,parent,isMain){
   if(name==='next/headers')return {cookies:async()=>({get:()=>({value:currentToken})})};
   if(name==='next/cache')return {revalidatePath:()=>{}};
   if(name==='next/navigation')return {redirect:(url)=>{const e=new Error('redirect:'+url);e.digest='NEXT_REDIRECT';throw e;}};
   if(name.startsWith('@/'))name=path.resolve('web/src',name.slice(2));
   return oldLoad.call(this,name,parent,isMain);
  };
  require.extensions['.ts']=function(module,filename){module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);};
  const {pool}=require('../web/src/db/index.ts');appPool=pool;
  const actions=require('../web/src/lib/actions.ts');const {runDemoPipeline}=require('../web/src/lib/demo.ts');
  const {submitOperation}=require('../web/src/lib/operations.ts');const {authorizedTransaction}=require('../web/src/lib/transaction.ts');
  const {trainingData,financeData}=require('../web/src/lib/workspace.ts');
  const parties=(await setup.query("select id,roles from party where 'trainer'=any(roles) or 'student'=any(roles) order by id")).rows;
  const tokens={};const users={};
  for(const role of ['management','sales','ops','finance','trainer','student']){
   const party=parties.find(p=>p.roles.includes(role));
   const user=(await setup.query('insert into app_user(email,role,party_id) values($1,$2,$3) returning id',[role+'@qa.example',role,party?.id??null])).rows[0];users[role]=user.id;
   await setup.query("insert into auth_credential(user_id,password_hash,must_change) values($1,'unused',false)",[user.id]);
   const token=randomBytes(32).toString('hex');tokens[role]=token;
   await setup.query("insert into auth_session(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')",[createHash('sha256').update(token).digest('hex'),user.id]);
  }
  currentToken=tokens.management;
  const requestId=randomUUID();const result=await runDemoPipeline(requestId);assert.equal(result.netProfit,'117000.00');
  const again=await runDemoPipeline(requestId);assert.equal(result.batchId,again.batchId);
  const events=(await setup.query('select actor_id from ledger_event where batch_id=$1',[result.batchId])).rows;
  assert(events.length>=9&&events.every(e=>e.actor_id===users.management));results.push('full lifecycle, replay idempotency, authenticated audit actor');
  await assert.rejects(authorizedTransaction('demo',async()=>{await actions.createLead({name:'ROLLBACK_FIXTURE'});throw new Error('injected failure');}));
  assert.equal((await setup.query("select count(*)::int n from party where name='ROLLBACK_FIXTURE'")).rows[0].n,0);results.push('injected failure rolls back prior lifecycle writes');
  const inv=(await setup.query('select id from invoice where batch_id=$1',[result.batchId])).rows[0].id;
  await assert.rejects(actions.recordPayment({invoiceId:inv,batchId:result.batchId,amount:'1'}));
  await assert.rejects(actions.recordExpense({batchId:result.batchId,amount:'-1',category:'venue'}));results.push('overallocated payment and negative expense rejected');
  currentToken=tokens.finance;
  const scheduled=(await setup.query('select id from payment where invoice_id=$1 and paid_at is null',[inv])).rows[0].id;
  assert.equal((await setup.query('select event_type from ledger_event where entity_id=$1 order by id desc limit 1',[scheduled])).rows[0].event_type,'payment.scheduled');
  const form=new FormData();form.set('kind','settle');form.set('requestId',randomUUID());form.set('paymentId',scheduled);form.set('method','bank');
  assert.equal((await submitOperation({ok:false,message:''},form)).ok,true);
  form.set('requestId',randomUUID());assert.equal((await submitOperation({ok:false,message:''},form)).ok,true);
  assert.equal((await setup.query('select status from invoice where id=$1',[inv])).rows[0].status,'paid');
  assert.equal(Number((await setup.query('select sum(amount) amount from payment where invoice_id=$1 and paid_at is not null',[inv])).rows[0].amount),250000);
  results.push('settlement updates invoice and cannot double-collect');
  currentToken=tokens.management;
  const leadEdit=new FormData();leadEdit.set('kind','leadEdit');leadEdit.set('requestId',randomUUID());leadEdit.set('enquiryId','00000000-0000-0000-0000-0000000000e1');leadEdit.set('name','Acme QA');leadEdit.set('email','qa@acme.example');leadEdit.set('phone','555-0100');leadEdit.set('source','referral');
  assert.equal((await submitOperation({ok:false,message:''},leadEdit)).ok,true);
  assert.deepEqual((await setup.query("select p.name,p.email,p.phone,e.source from enquiry e join party p on p.id=e.party_id where e.id='00000000-0000-0000-0000-0000000000e1'")).rows[0],{name:'Acme QA',email:'qa@acme.example',phone:'555-0100',source:'referral'});
  const invalidBatchEdit=new FormData();invalidBatchEdit.set('kind','batchEdit');invalidBatchEdit.set('requestId',randomUUID());invalidBatchEdit.set('batchId','00000000-0000-0000-0000-0000000000b1');invalidBatchEdit.set('name','Acme QA Batch');invalidBatchEdit.set('location','Chennai');invalidBatchEdit.set('startsOn','2026-09-10');invalidBatchEdit.set('endsOn','2026-09-09');
  const invalidBatchResult=await submitOperation({ok:false,message:''},invalidBatchEdit);assert.equal(invalidBatchResult.ok,false);assert.match(invalidBatchResult.message,/End date must follow start date/);
  invalidBatchEdit.set('requestId',randomUUID());invalidBatchEdit.set('endsOn','2026-09-20');assert.equal((await submitOperation({ok:false,message:''},invalidBatchEdit)).ok,true);
  assert.deepEqual((await setup.query("select name,location,starts_on::text,ends_on::text from batch where id='00000000-0000-0000-0000-0000000000b1'")).rows[0],{name:'Acme QA Batch',location:'Chennai',starts_on:'2026-09-10',ends_on:'2026-09-20'});
  const paidPayment=(await setup.query("select id from payment where invoice_id='00000000-0000-0000-0000-0000000000d1' and paid_at is not null and amount>0 limit 1")).rows[0].id;
  const refund=new FormData();refund.set('kind','refund');refund.set('requestId',randomUUID());refund.set('paymentId',paidPayment);refund.set('amount','50000');
  assert.equal((await submitOperation({ok:false,message:''},refund)).ok,true);
  refund.set('requestId',randomUUID());refund.set('amount','160000');const overRefund=await submitOperation({ok:false,message:''},refund);assert.equal(overRefund.ok,false);assert.match(overRefund.message,/exceeds what was actually collected/);
  assert.equal(Number((await setup.query("select coalesce(sum(-amount),0) total from payment where invoice_id='00000000-0000-0000-0000-0000000000d1' and method='refund'")).rows[0].total),50000);
  assert.equal((await setup.query("select status from invoice where id='00000000-0000-0000-0000-0000000000d1'")).rows[0].status,'part_paid');
  refund.set('requestId',randomUUID());refund.set('amount','150000');assert.equal((await submitOperation({ok:false,message:''},refund)).ok,true);
  assert.equal((await setup.query("select status from invoice where id='00000000-0000-0000-0000-0000000000d1'")).rows[0].status,'issued');
  assert.equal(Number((await setup.query("select coalesce(sum(amount),0) total from payment where invoice_id='00000000-0000-0000-0000-0000000000d1' and paid_at is not null")).rows[0].total),0);
  results.push('lead and batch edits persist, invalid date ranges fail, partial/full refunds produce correct balances and status');
  currentToken=tokens.management;
  await assert.rejects(setup.query("insert into attendance(enrollment_id,session_date,present) values('00000000-0000-0000-0000-0000000000c2',current_date-18,false)"),/duplicate key/);
  await assert.rejects(setup.query("insert into app_user(email,role) values('FINANCE@continuum.example','finance')"),/duplicate key/);
  await assert.rejects(setup.query("insert into batch(course_id,name,starts_on,ends_on) values('00000000-0000-0000-0000-0000000000c1','INVALID DATES',current_date,current_date-1)"),/check constraint/);
  await assert.rejects(setup.query("insert into expense(batch_id,category,amount) values('00000000-0000-0000-0000-0000000000b1','venue',0)"),/check constraint/);
  await assert.rejects(setup.query("insert into payment(invoice_id,amount,method,paid_at) values('00000000-0000-0000-0000-0000000000d1',-1,'bank',now())"),/check constraint/);
  await assert.rejects(actions.createLead({name:'INVALID',kind:'vendor'}),/Invalid party kind/);
  await assert.rejects(actions.recordExpense({batchId:result.batchId,amount:'1',category:'invalid'}),/Invalid expense category/);
  await assert.rejects(actions.recordPayment({invoiceId:inv,batchId:result.batchId,amount:'1',method:'crypto'}),/Invalid payment method/);
  results.push('database constraints and server validation reject duplicate attendance, duplicate email, invalid dates, money, enums and methods');
  currentToken=tokens.trainer;
  await assert.rejects(actions.createBatch({courseId:'00000000-0000-0000-0000-0000000000c1',name:'FORBIDDEN'}),/redirect/);
  const data=await trainingData();const assigned=parties.find(p=>p.roles.includes('trainer')).id;
  const expected=(await setup.query('select id from batch where trainer_id=$1',[assigned])).rows.map(r=>r.id).sort();
  assert.deepEqual(data.batches.map(b=>b.id).sort(),expected);
  const assignedNames=new Set(data.batches.map(b=>b.name));
  assert(data.enrollments.every(e=>assignedNames.has(e.batch))&&data.attendance.every(a=>assignedNames.has(a.batch)));
  results.push('trainer batch, enrollment and attendance isolation plus direct action denial');
  currentToken=tokens.student;await assert.rejects(actions.createLead({name:'FORBIDDEN'}),/redirect/);
  currentToken=tokens.sales;await assert.rejects(actions.raiseInvoice({partyId:assigned,batchId:result.batchId,amount:'1'}),/redirect/);
  currentToken=tokens.ops;await assert.rejects(actions.recordExpense({batchId:result.batchId,amount:'1',category:'venue'}),/redirect/);
  results.push('student, sales, ops cannot invoke unauthorized writes');
  currentToken=tokens.management;
  await setup.query(`insert into batch(course_id,trainer_id,name,status)
    select '00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a3','QA load '||g,'running' from generate_series(1,300) g`);
  await setup.query(`insert into invoice(party_id,batch_id,status)
    select '00000000-0000-0000-0000-0000000000a2',id,'part_paid' from batch where name like 'QA load %'`);
  await setup.query(`insert into invoice_line(invoice_id,batch_id,description,amount)
    select i.id,i.batch_id,'load projection check',1000 from invoice i join batch b on b.id=i.batch_id where b.name like 'QA load %'`);
  await setup.query(`insert into payment(invoice_id,amount,method,paid_at)
    select i.id,600,'bank',now() from invoice i join batch b on b.id=i.batch_id where b.name like 'QA load %'`);
  await setup.query(`insert into expense(batch_id,category,vendor,amount)
    select id,'venue','QA load vendor',100 from batch where name like 'QA load %'`);
  await setup.query(`insert into trainer_payment(batch_id,trainer_id,amount)
    select id,'00000000-0000-0000-0000-0000000000a3',200 from batch where name like 'QA load %'`);
  const loadPnl=(await setup.query("select count(*)::int n,sum(revenue)::numeric revenue,sum(cost)::numeric cost,sum(net_profit)::numeric net from batch_pnl where name like 'QA load %'")).rows[0];
  assert.deepEqual({n:loadPnl.n,revenue:Number(loadPnl.revenue),cost:Number(loadPnl.cost),net:Number(loadPnl.net)},{n:300,revenue:300000,cost:90000,net:210000});
  const kpi=(await setup.query('select * from dashboard_kpis')).rows[0];
  const raw=(await setup.query(`select
    (select coalesce(sum(amount-discount),0) from invoice_line) revenue,
    (select coalesce(sum(amount),0) from payment where paid_at is not null) collected,
    (select coalesce(sum(amount),0) from payment where paid_at is null) outstanding,
    (select coalesce(sum(amount),0) from expense)+(select coalesce(sum(amount),0) from trainer_payment) total_cost`)).rows[0];
  for(const key of ['revenue','collected','outstanding','total_cost'])assert.equal(Number(kpi[key]),Number(raw[key]));
  const loadedTraining=await trainingData(),loadedFinance=await financeData();
  assert.equal(loadedTraining.batches.length,250);assert.equal(loadedFinance.invoices.length,250);assert.equal(loadedFinance.payments.length,250);
  results.push('300-batch load validates P&L/KPI reconciliation and bounded workspace queries');
  currentToken='';await assert.rejects(runDemoPipeline(randomUUID()),/redirect/);results.push('anonymous direct lifecycle denied');
  fs.mkdirSync('audit-results',{recursive:true});fs.writeFileSync('audit-results/integration.json',JSON.stringify({schema,checks:results,pass:true},null,2));
  console.log(JSON.stringify({pass:true,checks:results},null,2));
 }finally{
  if(appPool)await appPool.end();
  // Only the random schema created in this invocation can be removed.
  if(!/^qa_[a-f0-9]{12}$/.test(schema))throw new Error('Unsafe schema cleanup');
  await setup.query('set search_path to public');await setup.query(`drop schema if exists ${schema} cascade`);await setup.end();
 }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
