// Applies a one-off .sql file passed as argv[2] to DATABASE_URL, inside a
// transaction. Used for targeted live fixes reviewed before running.
require('dotenv').config({ path: 'web/.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('usage: node scripts/apply-sql-file.js <path.sql>');
  const sql = fs.readFileSync(file, 'utf8');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('commit');
    console.log(`applied ${file}`);
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
