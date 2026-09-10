// Provision one initial account per role, plus both existing students.
// Random temporary passwords are written ONLY to an ignored local file.
require('dotenv').config({path:'web/.env.local',quiet:true});
const {Client}=require('pg');
const {randomBytes,scryptSync}=require('node:crypto');
const fs=require('node:fs');
async function main(){
 const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
 const credentials=[];
 try{
  await c.query('begin');
  const parties=(await c.query("select id,name,roles from party where 'student'=any(roles) or 'trainer'=any(roles) order by name")).rows;
  const accounts=['management','sales','ops','finance'].map(role=>({email:`${role}@continuum.local`,role,partyId:null}));
  for(const role of ['trainer','student']) for(const [i,p] of parties.filter(p=>p.roles.includes(role)).entries()) accounts.push({email:`${role}${i+1}@continuum.local`,role,partyId:p.id});
  for(const a of accounts){
   const {rows}=await c.query('insert into app_user(email,role,party_id) values($1,$2,$3) on conflict(email) do update set email=excluded.email returning id',[a.email,a.role,a.partyId]);
   if((await c.query('select 1 from auth_credential where user_id=$1',[rows[0].id])).rowCount)continue;
   const password=randomBytes(18).toString('base64url');const salt=randomBytes(16).toString('hex');
   const hash=salt+':'+scryptSync(password,salt,64).toString('hex');
   await c.query('insert into auth_credential(user_id,password_hash) values($1,$2)',[rows[0].id,hash]);
   await c.query("insert into ledger_event(event_type,entity_type,entity_id,payload) values('account.created','app_user',$1,$2)",[rows[0].id,JSON.stringify({source:'local bootstrap',role:a.role})]);
   credentials.push({...a,password});
  }
  await c.query('commit');
  if(credentials.length){fs.mkdirSync('audit-results',{recursive:true});fs.writeFileSync('audit-results/initial-accounts.json',JSON.stringify(credentials,null,2));}
  console.log(`Provisioned ${credentials.length} accounts. Temporary credentials saved to audit-results/initial-accounts.json. Password change required at first sign-in.`);
 }catch(e){await c.query('rollback');throw e;}finally{await c.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
