// Creates the least-privilege continuum_ai role and PROVES it is locked down.
// Run: node scripts/setup-ai-role.js
require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log('--- creating continuum_ai role ---');
  await client.query(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'continuum_ai') then
        create role continuum_ai nologin;
      end if;
    end $$;
  `);

  // Least privilege: usage on the schema, select on exactly three views.
  await client.query('grant usage on schema public to continuum_ai');
  await client.query(
    'grant select on batch_pnl, collections_aging, dashboard_kpis to continuum_ai'
  );

  // Explicitly ensure NOTHING else is readable, including future tables.
  await client.query(
    'revoke all on all tables in schema public from continuum_ai'
  );
  await client.query(
    'grant select on batch_pnl, collections_aging, dashboard_kpis to continuum_ai'
  );
  await client.query(
    'alter default privileges in schema public revoke all on tables from continuum_ai'
  );

  // The app connects as neondb_owner and must be able to SET LOCAL ROLE
  // continuum_ai for the duration of one transaction. Postgres only allows
  // SET ROLE to a role you are a member of, so grant membership (not login —
  // continuum_ai itself stays nologin, this just lets neondb_owner assume it).
  await client.query('grant continuum_ai to neondb_owner');

  console.log('--- role created; now proving it is locked down ---\n');

  // Each of these MUST fail. If any succeeds, the design is broken.
  const mustFail = [
    ['read PII base table', 'select email from party limit 1'],
    ['read invoices', 'select * from invoice limit 1'],
    ['read ledger', 'select * from ledger_event limit 1'],
    ['write an expense', "insert into expense (batch_id, category, amount) values (null,'other',1)"],
    ['delete a batch', 'delete from batch'],
    ['create a table', 'create table evil (x int)'],
  ];

  let failures = 0;
  for (const [label, query] of mustFail) {
    try {
      await client.query('begin');
      await client.query('set local role continuum_ai');
      await client.query('set local transaction read only');
      await client.query(query);
      await client.query('rollback');
      console.log(`  [!!] ${label.padEnd(22)} SUCCEEDED — SECURITY HOLE`);
      failures++;
    } catch (err) {
      await client.query('rollback').catch(() => {});
      console.log(`  [ok] ${label.padEnd(22)} blocked: ${err.message.slice(0, 60)}`);
    }
  }

  // These MUST succeed — the AI still needs to do its job.
  const mustPass = [
    ['read batch_pnl', 'select name, net_profit from batch_pnl limit 3'],
    ['read collections_aging', 'select amount from collections_aging limit 3'],
    ['read dashboard_kpis', 'select revenue from dashboard_kpis'],
  ];

  console.log('');
  for (const [label, query] of mustPass) {
    try {
      await client.query('begin');
      await client.query('set local role continuum_ai');
      await client.query('set local transaction read only');
      const r = await client.query(query);
      await client.query('rollback');
      console.log(`  [ok] ${label.padEnd(22)} allowed (${r.rows.length} rows)`);
    } catch (err) {
      await client.query('rollback').catch(() => {});
      console.log(`  [!!] ${label.padEnd(22)} BLOCKED — too restrictive: ${err.message.slice(0, 50)}`);
      failures++;
    }
  }

  // Confirm the role reverts after rollback (pooled connections must not leak it).
  const who = await client.query('select current_user');
  console.log(`\n  role after rollback: ${who.rows[0].current_user}`);
  if (who.rows[0].current_user !== 'neondb_owner') {
    console.log('  [!!] role leaked past transaction!');
    failures++;
  } else {
    console.log('  [ok] role correctly reverted');
  }

  await client.end();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('setup failed:', e.message);
  process.exit(1);
});
