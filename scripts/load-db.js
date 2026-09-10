// One-off loader: applies db/schema.sql then db/seed.sql against DATABASE_URL.
// Used because psql is not installed in this environment.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { verifiedConnectionString } = require('./db-connection');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const client = new Client({ connectionString: verifiedConnectionString(connectionString) });
  await client.connect();

  if (process.argv.includes('--reset')) {
    console.log('--- resetting public schema ---');
    await client.query('drop schema public cascade; create schema public;');
  }

  for (const file of ['db/schema.sql', 'db/seed.sql']) {
    const sql = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    console.log(`\n--- applying ${file} ---`);
    await client.query(sql);
    console.log(`--- ${file} applied OK ---`);
  }

  console.log('\n--- verifying batch_pnl ---');
  const res = await client.query('select * from batch_pnl order by net_profit;');
  console.table(res.rows);

  await client.end();
}

main().catch((err) => {
  console.error('Load failed:', err.message);
  process.exit(1);
});
