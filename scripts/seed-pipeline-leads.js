// Adds a handful of realistic leads at varied stages so /dashboard's
// leads/conversion KPI strip shows a believable pipeline instead of "1
// lead, 100% converted". Purely additive: new party + enquiry rows only,
// no batches, no invoices -- does not touch Acme/TCS's canonical P&L
// figures (net_profit stays 70000).
require('dotenv').config({ path: 'web/.env.local' });
const { Client } = require('pg');

const LEADS = [
  {
    name: 'Infosys BPM Services',
    email: 'training@infosysbpm.example',
    source: 'referral',
    stage: 'qualified',
    daysAgo: 12,
    note: 'Referred by Acme contact. Scoping a 15-seat DevOps cohort for Q4.',
  },
  {
    name: 'Wipro Digital Systems',
    email: 'l&d@wipro-digital.example',
    source: 'website',
    stage: 'contacted',
    daysAgo: 6,
    note: 'Inbound form fill. First call scheduled.',
  },
  {
    name: 'Cognizant Learning Hub',
    email: 'clh@cognizant.example',
    source: 'linkedin',
    stage: 'new',
    daysAgo: 2,
    note: null,
  },
  {
    name: 'HCL Talent Academy',
    email: 'academy@hcl.example',
    source: 'referral',
    stage: 'lost',
    daysAgo: 20,
    note: 'Went with an in-house programme instead. Keep warm for next quarter.',
  },
];

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Idempotent: skip any lead whose party name already exists.
  const existing = await client.query(
    `select name from party where name = any($1::text[])`,
    [LEADS.map((l) => l.name)]
  );
  const existingNames = new Set(existing.rows.map((r) => r.name));
  const toAdd = LEADS.filter((l) => !existingNames.has(l.name));

  if (toAdd.length === 0) {
    console.log('all pipeline leads already present, nothing to add.');
    await client.end();
    return;
  }

  await client.query('begin');
  for (const lead of toAdd) {
    const party = await client.query(
      `insert into party (kind, name, email, roles) values ('org', $1, $2, '{corporate_buyer}') returning id`,
      [lead.name, lead.email]
    );
    const partyId = party.rows[0].id;

    const finance = await client.query(
      `select id from app_user where role='finance' and email like '%continuum.example' limit 1`
    );
    const ownerId = finance.rows[0]?.id ?? null;

    const enquiry = await client.query(
      `insert into enquiry (party_id, source, stage, owner_id, created_at)
       values ($1, $2, $3::lead_stage, $4, now() - ($5 || ' days')::interval)
       returning id`,
      [partyId, lead.source, lead.stage, ownerId, lead.daysAgo]
    );
    const enquiryId = enquiry.rows[0].id;

    await client.query(
      `insert into ledger_event (event_type, entity_type, entity_id, payload)
       values ('lead.created', 'enquiry', $1, $2::jsonb)`,
      [enquiryId, JSON.stringify({ source: lead.source })]
    );

    if (lead.note) {
      await client.query(
        `insert into activity (enquiry_id, party_id, kind, note, owner_id, occurred_at)
         values ($1, $2, 'note', $3, $4, now() - ($5 || ' days')::interval)`,
        [enquiryId, partyId, lead.note, ownerId, lead.daysAgo]
      );
    }

    console.log(`added: ${lead.name} (${lead.stage})`);
  }
  await client.query('commit');

  const summary = await client.query(
    `select stage, count(*)::int n from enquiry group by stage order by stage`
  );
  console.log('\n--- enquiry stage distribution after seeding ---');
  console.table(summary.rows);

  const kpi = await client.query('select net_profit from dashboard_kpis');
  console.log('\ndashboard_kpis.net_profit (must still be 70000.00):', kpi.rows[0].net_profit);

  await client.end();
}

main().catch((e) => {
  console.error('seed-pipeline-leads failed:', e.message);
  process.exit(1);
});
