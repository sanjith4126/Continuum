# Production readiness audit — 10 September 2026

**Verdict: do not expose this app publicly with real customer data.** The existing demo works after the fixes below, but there is no authentication or application role authorization. This is a tested demo, not a production certification.

## Scope and evidence

Inspected all application routes, server actions, query helpers, AI paths, schema policies, and project requirements. Tested the configured PostgreSQL database without reloading its schema or seed. Browser results are in `audit-results/browser.json`, database observations in `audit-results/database.json`, and interactive workflow results in `audit-results/workflows.json`. Screenshots and an actual Excel download are also in that directory. These artifacts contain business data and should stay local.

- Visited the root, dashboard, valid/invalid historical dates, collections, pipeline, consultant, assistant, existing trace, malformed trace, missing trace, and health endpoint.
- Tested schedule and balance for both existing students: Ananya Sharma and Rahul Verma. Both return only their scoped programmes in these tests.
- Checked restricted database roles, enrollment isolation, unknown-student enrollment denial, party-table access denial, AI view access, and current-versus-as-of-now profit agreement. Invoice/payment/attendance row counts are observations, not an exhaustive proof of every possible RLS policy combination.
- Observed database policies for sales, ops, finance, trainer, and management. These are **not logged-in browser role tests**; those accounts and portals are absent.
- Executed one full demo lifecycle: lead, conversion, batch, enrollment, invoice, received and scheduled payments, expenses, trainer payment. Expected profit: ₹117,000.
- Tested date apply/reset, SQL collapse, actual `.xlsx` download, mobile pages at 390 × 844, and 20 dashboard requests with 10 concurrent clients. This small concurrency check is not a capacity or soak test.
- Ran ESLint, TypeScript, production build, validation/SQL guard regression tests, and npm production dependency audit. The audit command reported zero vulnerabilities in its configured registry snapshot; this is not a guarantee that dependencies have no vulnerabilities.

## Fixed in this audit

1. Historical P&L raw SQL now aliases database fields to the UI's expected names. Profit, React row keys, and trace links were broken by the old snake_case/camelCase mismatch.
2. Historical dates are validated, interpreted through end of day in India time, and exclude batches created after that date. Current KPI cards are explicitly labeled as current when viewing historical batch results.
3. Invalid trace UUIDs return 404 instead of a database exception. The trace query now includes pre-batch lead events and limits invoices to the lead's own batches rather than all invoices for its payer.
4. Database pages render per request rather than being frozen at build time.
5. Money, date, text, UUID, discount, GST range, student/trainer membership, and payment-to-batch checks run on the server. Repeating conversion of an already-won lead no longer duplicates the conversion event; conversion uses a row lock.
6. Malformed student IDs return a JSON 400. API/database failures have generic responses instead of exposing database errors; health failure returns 503.
7. Student selection is disabled during an outstanding answer, preventing cross-selection answer races. Chat inputs have accessible names and length limits.
8. Mobile layout no longer reserves a fixed 240px sidebar. Wide tables scroll within their containers, and lifecycle rows can wrap.
9. Added connection/query/provider timeouts and removed the explicit `rejectUnauthorized: false` TLS override. TLS behavior now follows the connection string; configure `sslmode=verify-full` for deployed PostgreSQL connections.
10. Consultant phrasing explicitly uses INR. Historical questions are rejected because its views have no period data; previously a quarterly question silently returned current/all-time results.
11. Excel code loads only when exporting. The misleading dashboard link is labeled “View batches.”
12. Missing demo prerequisites produce a clear error. Scheduled payments carry their state in event payloads and are displayed as scheduled in the event list.

## Release blockers and remaining work

| Priority | Finding | Required work |
| --- | --- | --- |
| Critical | No verified login/session. Public management pages, consultant endpoint, and server actions are accessible without a user identity. | Integrate an authentication provider; map verified accounts to `app_user`; check authorization in every action, API, and data-access path. |
| Critical | The assistant trusts a client-supplied student ID. RLS restricts the selected identity but does not prove the caller owns it. | Derive party ID exclusively from the verified session; remove the public student picker/listing. |
| High | No separate sales, ops, finance, trainer, or management application permissions. Trainer database policy currently sees all enrollments because its rule allows every role other than student. | Agree a role/operation matrix and implement assignment-based trainer restrictions and staff permissions; test direct URL/API/action bypass attempts for every role. |
| High | Mutations connect through the privileged application pool; audit actor IDs are not populated. | Use a least-privilege runtime database role and record the authenticated actor. |
| High | No distributed API rate limits or AI spending controls. | Enforce per-account quotas and deployment-wide rate limits after authentication. |
| High | Lifecycle is a sequence of individually committed transactions. Later failure can leave a partial journey; retries can duplicate records. | Define resumable/idempotent workflows or a single transaction for the demo operation, and test injected failures and concurrent retries. |
| High | Payment workflow creates new payment rows; there is no complete collection settlement, reconciliation, or refund workflow. Invoice status is not updated by payments. | Define financial state transitions, allocation/overpayment/GST rules, and implement them with transaction tests. |
| High | Project is a narrow demo compared with the supplied business problem. | CRM activity/quotation/agreement forms, operational batch/course/trainer management, attendance entry, and real role-specific business workflows remain unimplemented. |
| Medium | Runtime trace query is corrected, but `lead_to_outcome()` itself still has the original payer-wide invoices and missing pre-batch events. | Migrate the database function before external consumers rely on it; current app compensates in its read query. |
| Medium | SQL validator is regex-based; database grants remain the actual boundary. Existing policy tests cover seeded scenarios only. | Add adversarial relation/function tests and broader fixture-based policy tests; consider a SQL parser before expanding supported syntax. |
| Medium | Dashboard outstanding is scheduled unpaid payment rows, not necessarily total invoice debt. | Confirm accounting semantics and reconcile against invoice balances before operational use. |
| Medium | No tested production backup/restore, monitoring, alerting, hosting TLS, recovery, or sustained load targets. | Configure and verify these in the deployment environment. |

No real authenticated role could be tested because no login provider or credentials exist in this application. A clarification about the intended provider and role requirements was requested during the audit. Do not mistake the database role observations or the UI's “Admin / Ops” label for authenticated role coverage.

## Database change made by testing

One demo journey was added and retained with its ledger history:

- Lead: `945d7937-0242-497a-bfeb-8bab4c846de2`
- Trace: `/trace/945d7937-0242-497a-bfeb-8bab4c846de2`
- Revenue ₹250,000; collected ₹150,000; scheduled outstanding ₹100,000; costs ₹133,000; net profit ₹117,000.

No existing records, schema, or append-only events were deleted.

## Repeat checks

From the repository root, with the app running at `http://127.0.0.1:3000`:

```powershell
node scripts/validation-tests.js
node scripts/audit-db.js
python scripts/browser-audit.py
python scripts/workflow-audit.py --reuse
```

`workflow-audit.py` without `--reuse` creates another demo lifecycle. `--reuse` requires the existing local `audit-results/workflows.json`. Python Playwright with Chromium must be installed. Build and lint run from `web/` using `npm run build` and `npm run lint`.
