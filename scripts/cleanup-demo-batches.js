// Removes the "Demo Corp" test batches created while verifying Phase 3's
// pipeline write path, and everything that cascades from them, so the DB
// matches the clean Acme/TCS seed state (net profit = 70000) that CLAUDE.md,
// the dashboard, and the AI consultant's cached answer all assume.
require('dotenv').config({ path: 'web/.env.local' });
const { Client } = require('pg');
const { verifiedConnectionString } = require('./db-connection');

const BATCH_NAME_PATTERN = 'Demo Corp%';

async function main() {
  const client = new Client({ connectionString: verifiedConnectionString(process.env.DATABASE_URL) });
  await client.connect();

  const batches = await client.query(
    `select id, name, source_lead_id from batch where name like $1`,
    [BATCH_NAME_PATTERN]
  );
  console.log(`found ${batches.rows.length} demo batch(es) to remove:`);
  console.table(batches.rows);

  if (batches.rows.length === 0) {
    console.log('nothing to clean up.');
    await client.end();
    return;
  }

  const batchIds = batches.rows.map((r) => r.id);
  const leadIds = batches.rows.map((r) => r.source_lead_id).filter(Boolean);

  await client.query('begin');

  const invoices = await client.query(
    `select id from invoice where batch_id = any($1::uuid[])`,
    [batchIds]
  );
  const invoiceIds = invoices.rows.map((r) => r.id);

  // ledger_event is append-only by rule (no update/delete) EXCEPT the rule
  // does instead nothing on UPDATE/DELETE -- so a normal delete is silently
  // a no-op here. That's fine: leaving the ledger entries for the deleted
  // demo batches is consistent with "the ledger is the audit trail" (it
  // simply records that a demo batch existed and was later removed from
  // the operational tables). We only need the operational rows gone so
  // batch_pnl / dashboard_kpis / collections_aging stop counting them.

  if (invoiceIds.length > 0) {
    await client.query(`delete from payment where invoice_id = any($1::uuid[])`, [invoiceIds]);
    await client.query(`delete from invoice_line where invoice_id = any($1::uuid[])`, [invoiceIds]);
    await client.query(`delete from invoice where id = any($1::uuid[])`, [invoiceIds]);
  }

  await client.query(`delete from expense where batch_id = any($1::uuid[])`, [batchIds]);
  await client.query(`delete from trainer_payment where batch_id = any($1::uuid[])`, [batchIds]);
  await client.query(`delete from attendance where enrollment_id in (select id from enrollment where batch_id = any($1::uuid[]))`, [batchIds]);
  await client.query(`delete from enrollment where batch_id = any($1::uuid[])`, [batchIds]);
  await client.query(`delete from batch where id = any($1::uuid[])`, [batchIds]);

  if (leadIds.length > 0) {
    const enquiries = await client.query(`select id, party_id from enquiry where id = any($1::uuid[])`, [leadIds]);
    const partyIds = enquiries.rows.map((r) => r.party_id);
    await client.query(`delete from activity where enquiry_id = any($1::uuid[])`, [leadIds]);
    await client.query(`delete from enquiry where id = any($1::uuid[])`, [leadIds]);
    if (partyIds.length > 0) {
      await client.query(`delete from party where id = any($1::uuid[])`, [partyIds]);
    }
  }

  await client.query('commit');
  console.log('demo batches removed.');

  const pnl = await client.query('select * from batch_pnl order by net_profit');
  console.log('\n--- batch_pnl after cleanup ---');
  console.table(pnl.rows);

  const kpis = await client.query('select * from dashboard_kpis');
  console.log('\n--- dashboard_kpis after cleanup ---');
  console.table(kpis.rows);

  await client.end();
}

main().catch((e) => {
  console.error('cleanup failed:', e.message);
  process.exit(1);
});
