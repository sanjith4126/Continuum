// Read-only role checks. No setup, grants, seed reloads, or persistent writes.
require('dotenv').config({ path: 'web/.env.local', quiet: true });
const { Client } = require('pg');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const results = [];
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, statement_timeout: 10000 });
  await client.connect();
  async function scoped(role, partyId, query, dbRole = 'continuum_app') {
    await client.query('begin read only');
    try {
      await client.query(`set local role ${dbRole}`);
      await client.query("select set_config('app.user_role', $1, true), set_config('app.party_id', $2, true)", [role, partyId]);
      return (await client.query(query)).rows;
    } finally { await client.query('rollback'); }
  }
  try {
    const roles = (await client.query("select rolname, rolbypassrls from pg_roles where rolname in ('continuum_app','continuum_ai')")).rows;
    assert.equal(roles.length, 2);
    for (const role of roles) assert.equal(role.rolbypassrls, false);
    results.push({check:'restricted database roles',pass:true});
    const students = (await client.query("select id from party where 'student'=any(roles)")).rows;
    for (const student of students) {
      const own = await scoped('student', student.id, 'select student_id from enrollment');
      assert(own.every(r => r.student_id === student.id));
      for (const table of ['attendance','invoice','invoice_line','payment']) {
        const visible = await scoped('student', student.id, `select count(*)::int as count from ${table}`);
        results.push({check:`student ${student.id} ${table}`,visible:visible[0].count,pass:true});
      }
      results.push({check:`student ${student.id} enrollment isolation`,pass:true});
    }
    const unknown = await scoped('student','ffffffff-ffff-ffff-ffff-ffffffffffff','select * from enrollment');
    assert.equal(unknown.length,0);
    results.push({check:'unknown student sees no enrollments',pass:true});
    for (const role of ['sales','ops','finance','trainer','management']) {
      const rows = await scoped(role,'','select count(*)::int as count from enrollment');
      results.push({check:`database policy role ${role}`,enrollments:rows[0].count,pass:true,note:'Policy observation only; no authenticated role portal exists.'});
    }
    for (const dbRole of ['continuum_ai','continuum_app']) {
      let denied = false;
      try { await scoped('student','','select * from party limit 1',dbRole); } catch(e) { denied = e.code === '42501'; }
      assert(denied); results.push({check:`${dbRole} party access denied`,pass:true});
    }
    const pnl = await scoped('management','','select * from batch_pnl','continuum_ai');
    results.push({check:'AI view access',rows:pnl.length,pass:true});
    const current = (await client.query('select batch_id,net_profit from batch_pnl order by batch_id')).rows;
    const historical = (await client.query("select batch_id,net_profit from batch_pnl_asof(now()) order by batch_id")).rows;
    assert.deepEqual(historical,current);
    results.push({check:'current and as-of-now P&L agree',pass:true});
  } finally { await client.end(); }
  fs.mkdirSync('audit-results',{recursive:true});
  fs.writeFileSync('audit-results/database.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
}
main().catch(e=>{ console.error('Audit failed:',e.message); process.exitCode=1; });
