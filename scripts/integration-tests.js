// Isolated schema integration tests. No business writes to public.
require('dotenv').config({path:'web/.env.local',quiet:true});
const {Client}=require('pg');const fs=require('node:fs');const path=require('node:path');
const {randomUUID,randomBytes,createHash}=require('node:crypto');const assert=require('node:assert/strict');
const ts=require('../web/node_modules/typescript');const Module=require('node:module');
const schema='qa_'+randomBytes(6).toString('hex');const baseUrl=process.env.DATABASE_URL;
let currentToken='';const results=[];
async function main(){
 const direct=new URL(baseUrl);direct.hostname=direct.hostname.replace('-pooler.','.');
 const setup=new Client({connectionString:direct.toString()});await setup.connect();
 let appPool;
 try{
  await setup.query(`create schema ${schema}`);await setup.query(`set search_path to ${schema},public`);
  await setup.query(fs.readFileSync('db/schema.sql','utf8'));
  await setup.query(fs.readFileSync('db/seed.sql','utf8'));
  await setup.query(fs.readFileSync('db/migrations/001_production.sql','utf8').replaceAll('schema public',`schema ${schema}`));
  await setup.query(`grant usage on schema ${schema} to continuum_app,continuum_ai,continuum_staff`);
  await setup.query('grant select on enrollment,attendance,invoice,invoice_line,payment,batch,course to continuum_app');
  await setup.query('grant select on batch_pnl,collections_aging,dashboard_kpis to continuum_ai');
  const url=new URL(baseUrl);url.hostname=url.hostname.replace('-pooler.','.');url.searchParams.set('options',`-c search_path=${schema},public`);process.env.DATABASE_URL=url.toString();
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
  const {trainingData}=require('../web/src/lib/workspace.ts');
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
  const form=new FormData();form.set('kind','settle');form.set('requestId',randomUUID());form.set('paymentId',scheduled);form.set('method','bank');
  assert.equal((await submitOperation({ok:false,message:''},form)).ok,true);
  form.set('requestId',randomUUID());assert.equal((await submitOperation({ok:false,message:''},form)).ok,true);
  assert.equal((await setup.query('select status from invoice where id=$1',[inv])).rows[0].status,'paid');
  assert.equal(Number((await setup.query('select sum(amount) amount from payment where invoice_id=$1 and paid_at is not null',[inv])).rows[0].amount),250000);
  results.push('settlement updates invoice and cannot double-collect');
  currentToken=tokens.trainer;
  await assert.rejects(actions.createBatch({courseId:'00000000-0000-0000-0000-0000000000c1',name:'FORBIDDEN'}),/redirect/);
  const data=await trainingData();const assigned=parties.find(p=>p.roles.includes('trainer')).id;
  const expected=(await setup.query('select id from batch where trainer_id=$1',[assigned])).rows.map(r=>r.id).sort();
  assert.deepEqual(data.batches.map(b=>b.id).sort(),expected);results.push('trainer assignment isolation and direct action denial');
  currentToken=tokens.student;await assert.rejects(actions.createLead({name:'FORBIDDEN'}),/redirect/);
  currentToken=tokens.sales;await assert.rejects(actions.raiseInvoice({partyId:assigned,batchId:result.batchId,amount:'1'}),/redirect/);
  currentToken=tokens.ops;await assert.rejects(actions.recordExpense({batchId:result.batchId,amount:'1',category:'venue'}),/redirect/);
  results.push('student, sales, ops cannot invoke unauthorized writes');
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
