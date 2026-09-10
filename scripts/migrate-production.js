require('dotenv').config({path:'web/.env.local',quiet:true});
const {Client}=require('pg');
const fs=require('node:fs');
async function main(){
 const c=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});
 await c.connect();
 try { await c.query('begin'); await c.query(fs.readFileSync('db/migrations/001_production.sql','utf8')); await c.query('commit'); console.log('Additive production migration applied.'); }
 catch(e){await c.query('rollback');throw e;} finally{await c.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
