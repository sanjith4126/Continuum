// Creates continuum_app: the role the student assistant runs queries as, so
// RLS actually applies (neondb_owner owns the tables and has
// rolbypassrls=true, which makes RLS a no-op for that connection -- see the
// commit that adds this file for how that was discovered). Mirrors the
// continuum_ai pattern from Phase 5: least-privilege grants, explicit
// nobypassrls, then PROVES the isolation empirically rather than just
// declaring it.
require('dotenv').config();
const { Client } = require('pg');
const { verifiedConnectionString } = require('./db-connection');

async function main() {
  const client = new Client({ connectionString: verifiedConnectionString(process.env.DATABASE_URL) });
  await client.connect();

  console.log('--- creating continuum_app role ---');
  await client.query(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'continuum_app') then
        create role continuum_app nologin nobypassrls;
      end if;
    end $$;
  `);
  // in case the role pre-existed with different flags, force them explicitly
  await client.query('alter role continuum_app nobypassrls');

  await client.query('grant usage on schema public to continuum_app');
  // SELECT only, on exactly the tables the student assistant's typed tools
  // need: enrollment/attendance (schedule), invoice/payment/invoice_line
  // (balance), batch/course (names to join against). No party, no
  // ledger_event, no write anywhere.
  //
  // invoice_line now has its own RLS policy (invoice_line_access, added in
  // db/schema.sql) mirroring invoice_access's enrollment branch directly on
  // invoice_line.batch_id. An EARLIER version of this comment claimed the
  // grant was safe because application code only ever reached invoice_line
  // through an invoice join — that was wrong and this setup script's own
  // check 2b caught it live: a bare `select invoice_id from invoice_line`
  // as continuum_app returned TCS's line to a student enrolled only in
  // Acme's batch, because a GRANT has no idea how application code intends
  // to join a table. The fix is RLS on invoice_line itself, not careful
  // query authorship — that's what makes the grant actually safe now.
  const GRANTED_TABLES = 'enrollment, attendance, invoice, payment, invoice_line, batch, course';
  await client.query(`grant select on ${GRANTED_TABLES} to continuum_app`);
  await client.query('revoke all on all tables in schema public from continuum_app');
  await client.query(`grant select on ${GRANTED_TABLES} to continuum_app`);
  await client.query(
    'alter default privileges in schema public revoke all on tables from continuum_app'
  );
  await client.query('grant continuum_app to neondb_owner');

  console.log('--- role created; now proving RLS actually applies to it ---\n');

  const ANANYA = '00000000-0000-0000-0000-0000000000a5';
  const RAHUL = '00000000-0000-0000-0000-0000000000a6';

  async function asStudent(partyId, query) {
    await client.query('begin');
    await client.query('set local role continuum_app');
    await client.query('set local transaction read only');
    await client.query("set local app.user_role = 'student'");
    // SET LOCAL does not accept bind parameters; set_config() does and is
    // the standard way to set a session variable to a dynamic value safely.
    await client.query('select set_config($1, $2, true)', ['app.party_id', partyId]);
    const result = await client.query(query);
    await client.query('rollback');
    return result.rows;
  }

  let failures = 0;

  // 1. Confirm RLS is NOT bypassed for this role at all (the bug this file
  //    exists to fix). If this fails, everything below is meaningless.
  const roleCheck = await client.query(
    "select rolbypassrls from pg_roles where rolname = 'continuum_app'"
  );
  if (roleCheck.rows[0].rolbypassrls !== false) {
    console.log('[!!] continuum_app has rolbypassrls=true -- RLS would be a no-op');
    failures++;
  } else {
    console.log('[ok] continuum_app has rolbypassrls=false -- RLS will actually apply');
  }

  // 2. A base table with NO RLS policy (party) must be completely denied --
  //    no grant exists for it either.
  try {
    await client.query('begin');
    await client.query('set local role continuum_app');
    await client.query('select * from party limit 1');
    await client.query('rollback');
    console.log('[!!] read party (no grant, no RLS)  SUCCEEDED -- SECURITY HOLE');
    failures++;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    console.log(`[ok] read party (no grant, no RLS)  blocked: ${err.message.slice(0, 60)}`);
  }

  // 2b. invoice_line has RLS disabled at the table level but IS granted
  // (studentTools.ts needs it, always reached via a join to an
  // already-RLS-gated invoice — see the comment above). Confirm bare
  // enumeration of invoice_line still returns only rows whose invoice the
  // caller could already see via invoice's own RLS -- i.e. confirm the
  // grant does not become a bypass just because invoice_line itself has no
  // RLS policy of its own.
  try {
    const acmeLines = await asStudent(ANANYA, 'select invoice_id from invoice_line');
    const tcsLineId = '00000000-0000-0000-0000-0000000000d2';
    const leaksTcs = acmeLines.some((r) => r.invoice_id === tcsLineId);
    console.log(
      `[${!leaksTcs ? 'ok' : '!!'}] invoice_line grant does not leak TCS's line via bare select: ${!leaksTcs} (${acmeLines.length} row(s) visible)`
    );
    if (leaksTcs) failures++;
  } catch (err) {
    console.log(`[!!] invoice_line check errored unexpectedly: ${err.message.slice(0, 80)}`);
    failures++;
  }

  // 3. Ananya sees her own enrollment.
  const ananyaOwn = await asStudent(ANANYA, 'select * from enrollment');
  const ananyaSeesOwn = ananyaOwn.some((r) => r.student_id === ANANYA);
  const ananyaSeesRahul = ananyaOwn.some((r) => r.student_id === RAHUL);
  console.log(
    `[${ananyaSeesOwn ? 'ok' : '!!'}] Ananya sees her own enrollment: ${ananyaSeesOwn} (${ananyaOwn.length} row(s) total)`
  );
  console.log(
    `[${!ananyaSeesRahul ? 'ok' : '!!'}] Ananya does NOT see Rahul's enrollment: ${!ananyaSeesRahul}`
  );
  if (!ananyaSeesOwn || ananyaSeesRahul) failures++;

  // 4. Rahul sees his own enrollment, not Ananya's.
  const rahulOwn = await asStudent(RAHUL, 'select * from enrollment');
  const rahulSeesOwn = rahulOwn.some((r) => r.student_id === RAHUL);
  const rahulSeesAnanya = rahulOwn.some((r) => r.student_id === ANANYA);
  console.log(
    `[${rahulSeesOwn ? 'ok' : '!!'}] Rahul sees his own enrollment: ${rahulSeesOwn} (${rahulOwn.length} row(s) total)`
  );
  console.log(
    `[${!rahulSeesAnanya ? 'ok' : '!!'}] Rahul does NOT see Ananya's enrollment: ${!rahulSeesAnanya}`
  );
  if (!rahulSeesOwn || rahulSeesAnanya) failures++;

  // 5. Both students can reach the shared Acme invoice via their enrollment;
  //    neither can reach TCS's invoice (not enrolled there).
  const TCS_INVOICE = '00000000-0000-0000-0000-0000000000d2';
  const ACME_INVOICE = '00000000-0000-0000-0000-0000000000d1';
  for (const [label, partyId] of [['Ananya', ANANYA], ['Rahul', RAHUL]]) {
    const invoices = await asStudent(partyId, 'select id from invoice');
    const seesAcme = invoices.some((r) => r.id === ACME_INVOICE);
    const seesTcs = invoices.some((r) => r.id === TCS_INVOICE);
    console.log(
      `[${seesAcme ? 'ok' : '!!'}] ${label} sees the shared Acme invoice: ${seesAcme}`
    );
    console.log(
      `[${!seesTcs ? 'ok' : '!!'}] ${label} does NOT see TCS's invoice: ${!seesTcs}`
    );
    if (!seesAcme || seesTcs) failures++;
  }

  // 6. Role reverts after rollback.
  const who = await client.query('select current_user');
  const reverted = who.rows[0].current_user === 'neondb_owner';
  console.log(`\n[${reverted ? 'ok' : '!!'}] role after rollback: ${who.rows[0].current_user}`);
  if (!reverted) failures++;

  await client.end();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('setup failed:', e.message);
  process.exit(1);
});
