// Provision one initial account per role, plus both existing students.
// Random temporary passwords are written ONLY to an ignored local file.
require('dotenv').config({path:'web/.env.local',quiet:true});
const {Client}=require('pg');
const {randomBytes,scryptSync}=require('node:crypto');
const fs=require('node:fs');
const {verifiedConnectionString}=require('./db-connection');
async function main(){
 const rotate=process.argv.includes('--rotate');
 const c=new Client({connectionString:verifiedConnectionString(process.env.DATABASE_URL)});await c.connect();
 const credentials=[];
 try{
  await c.query('begin');
  const parties=(await c.query("select id,name,roles from party where 'student'=any(roles) or 'trainer'=any(roles) order by name")).rows;
  const accounts=['management','sales','ops','finance'].map(role=>({email:`${role}@continuum.local`,role,partyId:null}));
  for(const role of ['trainer','student']) for(const [i,p] of parties.filter(p=>p.roles.includes(role)).entries()) accounts.push({email:`${role}${i+1}@continuum.local`,role,partyId:p.id});
  for(const a of accounts){
   const {rows}=await c.query('insert into app_user(email,role,party_id) values($1,$2,$3) on conflict(email) do update set role=excluded.role,party_id=excluded.party_id returning id',[a.email,a.role,a.partyId]);
   const exists=(await c.query('select 1 from auth_credential where user_id=$1',[rows[0].id])).rowCount>0;
   if(exists&&!rotate)continue;
   const password=randomBytes(18).toString('base64url');const salt=randomBytes(16).toString('hex');
   const hash=salt+':'+scryptSync(password,salt,64).toString('hex');
   if(exists){
    await c.query('update auth_credential set password_hash=$1,must_change=true,disabled=false where user_id=$2',[hash,rows[0].id]);
    await c.query('delete from auth_session where user_id=$1',[rows[0].id]);
    await c.query('delete from password_reset where user_id=$1',[rows[0].id]);
   }else{
    await c.query('insert into auth_credential(user_id,password_hash) values($1,$2)',[rows[0].id,hash]);
   }
   await c.query("insert into ledger_event(event_type,entity_type,entity_id,payload) values($1,'app_user',$2,$3)",[exists?'account.updated':'account.created',rows[0].id,JSON.stringify({source:'local bootstrap',role:a.role,operation:exists?'credential.rotate':'create'})]);
   credentials.push({...a,password});
  }
  await c.query('commit');
  if(credentials.length){fs.mkdirSync('audit-results',{recursive:true});fs.writeFileSync('audit-results/initial-accounts.json',JSON.stringify(credentials,null,2));}
  console.log(`${rotate?'Rotated/provisioned':'Provisioned'} ${credentials.length} accounts. Temporary credentials saved to audit-results/initial-accounts.json. Password change required at first sign-in.`);
 }catch(e){await c.query('rollback');throw e;}finally{await c.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
