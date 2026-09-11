# Continuum Technical Viva Guide

Use this guide to explain the project in your own words. Do not memorize every sentence. Memorize the idea in **Short answer**, then use **If they ask deeper** only when the examiner follows up.

## The five facts to remember first

1. **Problem:** Training companies often manage enquiries, batches, attendance, invoices, collections, trainer payments, and expenses in separate tools, so they cannot reliably see profit or trace a lead through the complete lifecycle.
2. **Solution:** Continuum is an enquiry-to-profit operating system. It connects one lead to batches, enrollments, delivery, billing, collections, costs, and profit.
3. **Core design:** A batch is the profit centre. Revenue and cost records share a `batch_id`, which makes profitability traceable instead of estimated.
4. **Security:** Application permissions decide which pages and operations a role may use. Restricted PostgreSQL roles and row-level security provide a second database-level boundary.
5. **AI:** AI is an interface over controlled data, not the source of truth. The database performs every real calculation.

## Your opening answers

### 30-second problem statement

Training businesses often use a CRM for leads, spreadsheets for batches and attendance, and another tool for invoices. The data becomes disconnected, so management cannot easily answer which batch is profitable, which payment is overdue, or what happened to a lead. Continuum joins the complete process from enquiry to delivery, collections, costs, and profit in one auditable system.

### 30-second solution statement

Continuum gives sales, operations, trainers, finance, students, and management role-specific workspaces over one PostgreSQL database. The batch is the common business object connecting enrollments, attendance, invoice lines, expenses, and trainer payments. It also provides a read-only AI consultant for management and a tightly scoped student assistant.

### 90-second technical introduction

Continuum is a full-stack web application built with Next.js, React, TypeScript, Tailwind CSS, PostgreSQL on Neon, and Drizzle ORM. Server actions validate every input, authorize the current session, and execute related writes inside database transactions. Important retryable operations use request IDs, advisory locks, and an operation-result table so double-clicks or network retries do not create duplicates. The database contains operational tables, reporting views, constraints, indexes, restricted roles, and row-level security. Management AI can query only three approved reporting views through a read-only database role, while the student assistant never generates SQL and can access only the signed-in student's permitted data. The application is deployed on Vercel, while Neon supplies the serverless PostgreSQL database.

## Level 1: Basics and technology stack

### 1. What is Continuum?

**Short answer:** Continuum is an enquiry-to-profit operating system for training businesses. It manages the lifecycle from a sales enquiry through batch delivery, invoicing, collection, cost recording, and profitability.

**If they ask deeper:** It is not only a dashboard. It has six business roles, transactional workflows, reporting views, an append-only audit trail, and two different AI experiences with different security models.

### 2. Who are the users?

**Short answer:** Management, sales, operations, finance, trainers, and students.

**If they ask deeper:** These are business roles. They should not be confused with the restricted PostgreSQL roles used as technical security boundaries.

### 3. What technology stack did you use?

**Short answer:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, PostgreSQL hosted on Neon, Drizzle ORM, Groq for the language model, and Vercel for deployment.

**If they ask deeper:** PostgreSQL performs business calculations and access enforcement. The language model only translates questions or phrases results; it does not calculate the financial figures.

### 4. Why did you use Next.js instead of separate React and Express projects?

**Short answer:** Next.js provides the UI, server rendering, routing, server actions, and API routes in one TypeScript codebase. That reduced deployment complexity while preserving a clear server boundary.

**If they ask deeper:** A modular monolith was appropriate because most workflows need strong transactions across sales, operations, and finance data. Separate services would add network and consistency problems before the workload requires them.

### 5. What is React doing in this project?

**Short answer:** React builds the component-based user interface. It lets us reuse forms, tables, status indicators, navigation, and dashboard components while updating interactive parts without reloading the complete page.

### 6. Why TypeScript?

**Short answer:** TypeScript catches many data-shape and function-contract mistakes before runtime. This is useful in a system where invoice, payment, role, and operation payloads must be handled consistently.

**If they ask deeper:** TypeScript improves application correctness, but it is not a replacement for runtime validation or database constraints because browser requests and stored data are outside the compiler's control.

### 7. Why Tailwind CSS?

**Short answer:** Tailwind made it fast to create a consistent responsive interface without maintaining a large separate stylesheet. It also made role dashboards and mobile layouts easier to standardize.

### 8. Why PostgreSQL instead of MongoDB?

**Short answer:** This domain is strongly relational and financial. It needs foreign keys, atomic transactions, joins, constraints, reporting views, and row-level security, all of which are natural strengths of PostgreSQL.

**If they ask deeper:** A document database could store the records, but enforcing invoice-payment consistency and securely joining a student to a batch and invoice would be more complicated.

### 9. What is Neon?

**Short answer:** Neon is the managed PostgreSQL service used by the project. It provides the database without us operating our own database server and works well with a serverless Vercel deployment.

### 10. What is Drizzle ORM, and why use it?

**Short answer:** Drizzle is a TypeScript ORM and query builder. It gives typed application queries while still allowing raw SQL for views, database roles, RLS policies, and reporting functions.

**If they ask deeper:** We did not force every database feature through the ORM. The project uses the ORM where types improve development and SQL where PostgreSQL features are clearer and stronger.

### 11. What is Groq used for?

**Short answer:** Groq hosts the language model used by the management consultant and the student intent router. It is accessed through an OpenAI-compatible API.

**If they ask deeper:** Groq is not in the critical accounting path. All financial values come from PostgreSQL, so a model failure cannot change stored revenue, cost, or profit.

### 12. What does Vercel do?

**Short answer:** Vercel builds and hosts the Next.js application, serves the frontend, and runs server actions and API routes. Environment secrets are configured on the platform rather than placed in source code.

## Level 2: Architecture and request flow

### 13. Describe the high-level architecture.

**Short answer:** The browser talks to Next.js pages, server actions, and API routes. Server code authenticates and validates the request, then accesses Neon PostgreSQL through a small connection pool. Groq is called only for the two AI features.

### 14. What happens when a user submits a form?

**Short answer:** A server action receives the form, validates and normalizes every field, verifies the session and required permission, starts an authorized transaction, performs the database change, writes an audit event, commits, and revalidates the affected page.

**If they ask deeper:** Validation is done on the server even if the form has client-side constraints, because client validation can be bypassed.

### 15. What is a server action?

**Short answer:** A server action is a function that runs only on the server and can be called from a Next.js form or component. It is useful here because permissions, secrets, and database writes never need to be exposed to the browser.

### 16. How are permissions checked?

**Short answer:** Each business operation maps to a named permission. An authorized transaction checks the signed-in user and permission before opening the write path.

**If they ask deeper:** Page visibility is only user experience. The server action or API repeats authorization, so manually calling a hidden endpoint does not grant access.

### 17. What is an authorized transaction?

**Short answer:** It is the project's transaction wrapper. It confirms the session and permission, begins a PostgreSQL transaction, switches to the restricted staff database role, sets the current business role and party ID locally, and executes the operation.

### 18. Why use `SET LOCAL ROLE` rather than only connect as the database owner?

**Short answer:** The database owner can bypass ordinary restrictions. Switching to a restricted, non-bypass role makes PostgreSQL enforce the intended grants and RLS policies during that transaction.

**If they ask deeper:** `SET LOCAL` is transaction-scoped, so role and identity settings do not leak into another request when a pooled connection is reused.

### 19. How do nested actions remain atomic?

**Short answer:** The transaction helper uses asynchronous request context to reuse an existing transaction. A higher-level workflow can call smaller actions without accidentally committing each one separately.

**If they ask deeper:** The demo lifecycle is one example: if a later step fails, the parent transaction can roll back all earlier steps.

### 20. Why is a transaction important?

**Short answer:** A transaction gives all-or-nothing behavior. It prevents a workflow from leaving half-created financial or operational records when an error occurs.

### 21. How does the application handle errors?

**Short answer:** Expected validation and permission errors are returned as safe messages. Unexpected database or service errors are logged on the server while the user receives a controlled failure rather than an internal stack trace.

### 22. Why is this a modular monolith?

**Short answer:** Sales, operations, and finance are separate modules in one deployable application and one relational database. This keeps cross-module transactions simple and is appropriate for the current scale.

**If they ask deeper:** Module boundaries make later extraction possible, but starting with microservices would create operational overhead without solving a present bottleneck.

### 23. How are database connections controlled in a serverless environment?

**Short answer:** The PostgreSQL pool is deliberately small and has connection, statement, and idle timeouts. This prevents a single serverless instance from opening an unlimited number of database connections.

**If they ask deeper:** At larger scale I would use the provider's pooled connection endpoint and tune concurrency based on Neon and Vercel limits.

### 24. Why revalidate pages after a write?

**Short answer:** Next.js may cache server-rendered data. Revalidation tells it that affected routes must fetch fresh database state after a successful transaction.

## Level 3: Database and business logic

### 25. What is the central data-model decision?

**Short answer:** The batch is the profit centre. Invoice-line revenue, normal expenses, and trainer payments all reference the same batch.

**If they ask deeper:** This provides a traceable profitability key. Without it, management would have to allocate income and cost later using unreliable spreadsheet assumptions.

### 26. How is batch profit calculated?

**Short answer:** Revenue is the sum of invoice-line amount minus discount for the batch. Cost is the sum of expenses plus trainer payments. Profit is revenue minus total cost.

**Formula:** `net_profit = SUM(invoice_line.amount - discount) - SUM(expense.amount) - SUM(trainer_payment.amount)`

### 27. Is GST included in profit?

**Short answer:** GST is stored on the invoice for billing, but the batch P&L view uses net invoice-line revenue before tax. Tax collected on behalf of the government is not treated as operating revenue.

### 28. What is the difference between an invoice and an invoice line?

**Short answer:** The invoice is the billing document and customer-level header. Invoice lines contain the actual billed items and their batch links, which is why revenue attribution happens at the line level.

### 29. What is the difference between a scheduled payment and a received payment?

**Short answer:** A scheduled payment represents an expected installment with a due date. When it is settled, `paid_at` is recorded. Outstanding collections are based on unpaid scheduled rows, while collected cash is based on paid rows including negative refund records.

### 30. How is invoice status calculated?

**Short answer:** The system compares collected amounts with the invoice total and updates the status to unpaid, partially paid, or paid. Refunds can move the status back because they reduce net collected amount.

### 31. How do refunds work?

**Short answer:** A refund is appended as a negative payment rather than deleting or editing the original receipt. The operation locks the relevant record, verifies that total refunds cannot exceed the original payment, and links the refund to the original payment in the audit payload.

**If they ask deeper:** This preserves financial history and makes the net collection mathematically transparent.

### 32. How do you prevent overpayment?

**Short answer:** The invoice is checked inside the transaction, and the new payment is rejected if it would make the allowed collected amount invalid. Performing the check and write in the same locked transaction avoids a race between two requests.

### 33. How do you prevent duplicate submissions?

**Short answer:** Retryable operations receive a UUID request ID. The transaction takes an advisory lock on the user-and-request combination and stores the successful response in an operation-request table. A retry receives the stored result instead of inserting again.

**If they ask deeper:** Individual tables also have natural protections. Attendance is an upsert with a unique enrollment-and-date key, and settlement updates only a row whose `paid_at` is still null.

### 34. What is an advisory lock?

**Short answer:** It is an application-defined PostgreSQL lock. Continuum hashes the user and request ID into a lock key so two concurrent copies of the same request cannot both pass the duplicate check.

### 35. Why is a request ID not enough by itself?

**Short answer:** Without a unique record or lock, two requests can check for the ID at the same time, both see nothing, and both write. The advisory lock serializes that critical section.

### 36. What is collections aging?

**Short answer:** It shows unpaid scheduled payments, their due dates, days overdue, and the amount at risk. The amount is counted as at risk only when the due date has passed.

### 37. How does historical P&L work?

**Short answer:** The selected date is interpreted as the end of that day in Asia/Kolkata. The query includes invoice lines, expenses, and trainer payments whose effective timestamps are on or before that point and excludes batches created later.

**Important:** Do not say that historical P&L is reconstructed by replaying ledger events. It is calculated from effective dates on the operational financial records.

### 38. What is the audit ledger?

**Short answer:** `ledger_event` is an append-only history of important business actions such as creation, settlement, and refund. It records the actor, entity, event type, time, batch association, and structured payload.

### 39. Is Continuum event-sourced?

**Short answer:** No. It is a relational transactional system with an append-only audit log. Current business state comes from the operational tables; the ledger improves traceability but is not replayed to rebuild the whole database.

### 40. Why is the audit log append-only?

**Short answer:** Audit history should describe what happened at that time. Update and delete operations are blocked so a later user cannot silently rewrite the history.

### 41. Why can a ledger event retain a batch ID even after test cleanup?

**Short answer:** The ledger's batch reference is intentionally not a normal cascading foreign key. That lets an audit record survive controlled deletion of related test data instead of losing historical evidence.

### 42. What is lead-to-outcome traceability?

**Short answer:** A PostgreSQL function returns one lead together with related batches, invoices, P&L, and audit events. It proves how an enquiry moved through operational delivery and financial outcome.

### 43. What is the party model?

**Short answer:** A common party table represents people or organizations used across the domain. Business records refer to a party rather than creating inconsistent copies of identity data in every module.

### 44. How many database objects are central to the production design?

**Short answer:** The current production schema has 20 main tables and three approved reporting views. The exact number matters less than explaining that tables store transactions and views expose controlled calculated results.

### 45. What constraints protect the data?

**Short answer:** The schema uses primary keys, foreign keys, unique constraints, allowed-value checks, non-negative or positive amount rules, and date/status rules. Application validation gives a friendly error; database constraints remain the final guard.

### 46. Why use database views for KPIs?

**Short answer:** Views place the financial formula in one reviewed database definition. The dashboard and AI consultant then use the same calculation instead of duplicating logic in multiple UI components.

## Level 4: Authentication and security

### 47. How does login work?

**Short answer:** The server looks up the credential, verifies the scrypt password hash, creates a cryptographically random session token, stores only its SHA-256 hash, and sends the raw token in a secure HTTP-only cookie.

### 48. Why hash the session token in the database?

**Short answer:** If the session table leaks, the stored hash cannot directly be used as a browser session. The raw bearer token exists only in the user's cookie.

### 49. How are passwords stored?

**Short answer:** Passwords are salted and hashed with scrypt, a memory-hard password hashing function. They are never stored as plaintext or reversible encryption.

**If they ask deeper:** Verification uses a timing-safe comparison. Password length is validated on the server.

### 50. What is the dummy hash during login?

**Short answer:** Even when an email does not exist, the server performs a comparable password-hash verification. This reduces timing differences that could reveal which email addresses are registered.

### 51. How long does a session last?

**Short answer:** The configured session lifetime is eight hours. Logout revokes the stored session, and password changes revoke the user's sessions.

### 52. How is brute force limited?

**Short answer:** Login and reset flows use database-backed request buckets with both global and per-identity limits. Database storage means the limits are shared across Vercel instances rather than resetting in each process.

### 53. How does forgot-password work?

**Short answer:** It always returns the same public response whether or not an account exists, rate-limits the request, generates a temporary password for a real account, stores its new hash, revokes existing sessions, records an audit event, and attempts delivery through Resend.

**Honest limitation:** Email is sent after the database commit. If delivery fails, the failure is logged, but a production system should add a durable email queue and a proper expiring reset-link flow.

### 54. What is the difference between authentication and authorization?

**Short answer:** Authentication proves who the user is. Authorization decides what that authenticated user is allowed to see or do.

### 55. How many authorization layers exist?

**Short answer:** There are three practical layers: route and UI gating, server-side permission checks, and database grants/RLS. The first improves usability; the latter two protect the data.

### 56. What is row-level security?

**Short answer:** RLS is a PostgreSQL feature that filters or rejects rows according to policies inside the database. Continuum uses it to restrict student records to the signed-in party and trainer records to assigned batches.

### 57. Why use RLS if the application already checks permissions?

**Short answer:** It is defense in depth. If a query is written incorrectly, the restricted database role and RLS policy can still prevent cross-user data exposure.

### 58. What are the three restricted database roles?

**Short answer:** `continuum_staff` executes authorized staff workflows, `continuum_app` serves tightly scoped student queries under RLS, and `continuum_ai` can select only from the three approved reporting views.

**Important:** These are database roles, not the six business roles shown in the interface.

### 59. How is trainer isolation enforced?

**Short answer:** A trainer is allowed to mark attendance only for batches assigned to that trainer. The application checks assignment and the database's RLS policy provides a second boundary.

### 60. How is student identity protected?

**Short answer:** The student party ID is taken from the verified server session, never from a model response or a browser-supplied identity field. Student queries then execute with local identity settings under the restricted app role and RLS.

### 61. How do you prevent SQL injection?

**Short answer:** Normal application queries are parameterized through Drizzle or PostgreSQL parameters, and inputs are validated. The management AI path adds SQL validation, but its strongest boundary is a database role that cannot read base tables or write anything.

### 62. How do you protect against CSRF?

**Short answer:** The session cookie is secure, HTTP-only, and SameSite=Lax. API mutation routes also check same-origin or fetch-site headers before accepting the request.

**Honest limitation:** For a larger internet-facing product, I would add explicit CSRF tokens to sensitive browser mutations and continuously test the complete deployment path.

### 63. How do you protect against XSS and clickjacking?

**Short answer:** React escapes ordinary rendered values, and production headers include a content security policy, `X-Frame-Options: DENY`, MIME sniffing protection, a strict referrer policy, and a permissions policy.

**Honest limitation:** The present CSP permits inline code needed by the current Next.js setup. A nonce-based policy would be a future hardening step.

### 64. Where are secrets stored?

**Short answer:** Database, Groq, Resend, and deployment credentials belong in environment variables on the deployment platform and are excluded from source control. Any token shown in a message or screenshot must be revoked and replaced.

## Level 5: AI design and safety

### 65. What are the two AI features?

**Short answer:** Management has a natural-language data consultant over approved reporting views. Students have an assistant that routes a question to fixed schedule or balance tools.

### 66. Why do the two assistants use different architectures?

**Short answer:** Management needs flexible analytical questions, so controlled text-to-SQL is useful. Students need only two narrow personal tasks, so fixed parameterized tools are safer and more predictable than generated SQL.

### 67. Explain the management AI pipeline.

**Short answer:** The question is rate-limited and length-checked. The model proposes a SELECT query, the server validates its structure and allowed views, PostgreSQL explains it under the restricted AI role, the query runs read-only with time and row limits, and the model summarizes the real result rows.

### 68. Which data can the management AI read?

**Short answer:** Only the three approved reporting views: batch profitability, collections aging, and dashboard KPIs. Its database role has no grant on base tables containing names, emails, passwords, sessions, or operational details.

### 69. Is the SQL keyword filter the main security boundary?

**Short answer:** No. Static validation rejects obviously unsafe or irrelevant SQL, but the real security boundary is PostgreSQL permissions on the non-bypass `continuum_ai` role. Even a validator mistake should still encounter a database denial.

### 70. Why run `EXPLAIN` before the AI query?

**Short answer:** It lets PostgreSQL parse and plan the query under the same restricted role before execution. This catches invalid or inaccessible queries early.

**If they ask deeper:** Because views expand internally during planning, the system does not incorrectly reject every internal base relation shown by an explain plan; database grants remain the authority.

### 71. How do you limit expensive AI queries?

**Short answer:** Queries are SELECT-only, limited to approved views, given a maximum row count, executed in a read-only transaction, and stopped by a short statement timeout. The endpoint also has per-minute and per-day request quotas.

### 72. What if the model writes bad SQL?

**Short answer:** The validator or database rejects it. The system can give the model one correction attempt using the error, then returns a clean boundary or failure message rather than running uncontrolled statements.

### 73. How do you reduce hallucination?

**Short answer:** The final answer is grounded in rows returned by PostgreSQL, not in the model's memory. The interface can show the SQL and result data, making the answer inspectable.

### 74. How do you handle prompt injection?

**Short answer:** The model has no general tools, no write permission, and no base-table access. User text cannot change PostgreSQL grants. Generated SQL still passes the server guard, read-only transaction, limits, timeout, and restricted role.

### 75. Are any AI answers hardcoded?

**Short answer:** Two common demo questions can use cached, reviewed SQL patterns for speed and reliability, but the SQL still runs against the live database. The answer values are not hardcoded.

### 76. What happens if Groq is unavailable?

**Short answer:** The core CRM, operations, finance, reporting, and audit workflows continue to work. Known consultant questions have reviewed query paths, the student router has a keyword fallback, and other AI questions return a controlled error.

### 77. Why does the consultant reject historical-period questions?

**Short answer:** Its three approved views represent current reporting state. Rather than invent a historical answer, it states the boundary; historical P&L is available through the dedicated date-aware dashboard query.

### 78. How does the student assistant work without generated SQL?

**Short answer:** The model classifies the request as schedule or balance. The server ignores any model-provided identity, obtains the party from the session, and runs a fixed parameterized query under RLS.

### 79. Why can a student see a shared programme balance?

**Short answer:** A corporate training invoice can apply to the batch rather than to an individual learner. The interface therefore labels it as programme balance and exposes it only through the student's enrollment relationship, not as personal debt.

## Level 6: Testing, deployment, and operations

### 80. What tests were performed?

**Short answer:** The project has validation regression tests, database integration tests, role-and-route browser tests, and production database security audits, in addition to linting, type checking, and a production build.

### 81. What does the integration test cover?

**Short answer:** It creates an isolated PostgreSQL schema, loads the real schema and migrations, and tests the lifecycle, idempotency, rollback, permissions, refund and overpayment bounds, constraints, trainer isolation, P&L reconciliation, and larger data volumes.

### 82. Why use an isolated random schema for integration tests?

**Short answer:** It exercises real PostgreSQL behavior without modifying the public production schema. The test can create and remove its own namespace safely and repeatably.

### 83. What is tested in the browser role audit?

**Short answer:** Anonymous routes and APIs are checked, then eight test accounts are exercised across nine protected routes. That gives 72 role-route checks, plus API permission attempts, identity-injection tests, responsive screenshots, and session revocation after logout.

### 84. How do you test database security instead of only the UI?

**Short answer:** Setup and audit scripts switch into the restricted roles and deliberately attempt forbidden reads and writes. They verify that student cross-party access, AI base-table access, and unauthorized modifications fail inside PostgreSQL.

### 85. How do you test performance-related behavior?

**Short answer:** Integration tests generate hundreds of batches, reconcile profit totals, and verify that workspace queries remain bounded. Query timeouts, page limits, indexes, and AI row limits prevent accidental unbounded work.

### 86. How is the project deployed?

**Short answer:** Source is built by Vercel as a Next.js application. Vercel environment variables connect server code to Neon PostgreSQL, Groq, and optional Resend email delivery. Database schema and role migrations are applied separately and verified before the application deployment is promoted.

### 87. What checks should run before production deployment?

**Short answer:** Install with the lockfile, run lint, TypeScript checking, validation tests, integration tests against a safe database, a production build, database role audits, and role-browser tests against the deployed URL.

### 88. What will be the first scaling bottleneck?

**Short answer:** Reporting views that aggregate a growing financial history and external AI latency are more likely bottlenecks than the React UI. At scale I would add measured indexes, pre-aggregated or materialized reporting data, caching, pagination, and background jobs.

### 89. How would you support thousands of concurrent users?

**Short answer:** Use a pooled database endpoint, control serverless concurrency, cache read-heavy dashboards, move email and long jobs to a durable queue, add observability, and scale reporting separately. I would make these changes from measurements rather than guessing.

### 90. Is the system multi-tenant?

**Short answer:** The current judged product models one training organization with multiple roles and parties. True SaaS multi-tenancy would require an organization ID on every tenant-owned table, tenant-aware unique keys, RLS policies, provisioning, billing, and tenant-isolation tests.

### 91. What monitoring is still needed?

**Short answer:** Production should have structured error tracking, latency and database-pool metrics, authentication and rate-limit alerts, AI failure-rate monitoring, audit retention controls, and availability checks.

### 92. What backup and recovery work is needed?

**Short answer:** Managed database backups must be configured and, more importantly, restoration must be tested. A production plan should define recovery point and recovery time objectives and document rollback procedures for both application and database changes.

## Level 7: Hard challenge questions

### 93. Did AI build this project for you?

**Short answer:** AI accelerated implementation and review, but the engineering decisions still had to be understood and verified. I can explain the data model, transaction boundaries, security layers, calculations, failure cases, and tests, and the working system is the evidence.

**Never answer:** “AI made everything, so I do not know the code.”

### 94. What is the most important technical decision?

**Short answer:** Making the batch the common profitability key. It connects commercial revenue with delivery costs and turns disconnected records into an auditable enquiry-to-profit lifecycle.

### 95. What was a difficult correctness problem?

**Short answer:** Making retryable financial and attendance operations safe. UI button disabling was insufficient, so the solution uses server-generated request IDs, database advisory locks, cached operation results, unique constraints, conditional updates, and transactional tests.

### 96. Why not use Salesforce or Zoho?

**Short answer:** General CRMs are strong at leads and customer activity, but the problem statement requires training delivery, batch-linked revenue and cost, attendance, and profitability as one native workflow. Continuum demonstrates that vertical integration directly.

### 97. Why not use an LMS?

**Short answer:** An LMS focuses on content delivery and learning progress. Continuum focuses on operational and financial continuity from enquiry through batch economics. An LMS could integrate with it rather than replace this business model.

### 98. Why not use Odoo or another ERP?

**Short answer:** A full ERP covers a much wider domain and requires significant configuration. Continuum is intentionally narrow around the training company's lead-to-profit question, which makes the workflow and dashboards simpler.

### 99. What is the biggest current limitation?

**Short answer:** It is production-oriented for the judged scope, but not yet a complete enterprise platform. Durable job queues, formal backup restoration drills, full observability, multi-tenancy, deep accounting integration, accessibility testing, and extended load testing remain future work.

### 100. Can you call it production-ready?

**Short answer:** I would say it is production-ready for a controlled pilot after environment, migration, security, and backup checks. I would not claim enterprise certification or unlimited scale without monitoring data, recovery drills, and a real operational period.

### 101. What would you improve first with another month?

**Short answer:** First I would add observability and a durable job queue, then implement expiring reset links, strengthen CSP with nonces, automate deployment migrations and smoke tests, and run accessibility and load tests. These improve operational safety without changing the core data model.

### 102. What happens if a transaction fails halfway through?

**Short answer:** PostgreSQL rolls back the complete transaction, including nested operations using the same transaction context. The idempotency result is saved only after successful work, so a failed attempt can be retried safely.

### 103. What if two finance users settle the same installment simultaneously?

**Short answer:** The operation is transactional and updates only an installment whose `paid_at` is null. The request-id lock handles duplicate retries, and the conditional update prevents the same scheduled payment from being collected twice.

### 104. What if two users try to overpay an invoice at the same time?

**Short answer:** The relevant invoice state is checked while locked inside the transaction, so concurrent requests cannot both rely on the same stale balance. One transaction finishes first; the later transaction sees the new total and is rejected if it exceeds the allowed amount.

### 105. What if an examiner says regex cannot secure AI SQL?

**Short answer:** I agree. Regex and parsing checks are useful early rejection, not the security boundary. The AI query executes read-only as `continuum_ai`, a non-bypass database role with SELECT grants only on three views, plus a timeout and row limit.

### 106. What if an examiner says server-side permissions are enough and RLS is unnecessary?

**Short answer:** Server authorization is necessary, but it can contain implementation mistakes. RLS puts identity-based restrictions next to the data, so the two layers fail independently and give stronger protection for student and trainer access.

### 107. What if the financial totals are wrong?

**Short answer:** I would first reconcile invoice-line revenue, expenses, trainer payments, payments, and refunds directly in SQL for the affected batch. Because formulas are centralized in views and each change is audited, the discrepancy can be traced rather than guessed.

### 108. Why should judges trust the demo data?

**Short answer:** The demo workflow writes real relational records inside one transaction, and dashboards query those records live. The reference lifecycle produces ₹250,000 revenue, ₹133,000 cost, and ₹117,000 profit, which can be independently recomputed from the underlying rows.

## Rapid-fire numbers and facts

- Six business roles: management, sales, operations, finance, trainer, student.
- Three restricted database roles: staff, student app, AI reader.
- Eight demo accounts are tested across nine routes: 72 authenticated route checks.
- Session lifetime: eight hours.
- Password hashing: scrypt with a random salt.
- Session storage: SHA-256 hash of a random raw token.
- AI input limit: 500 characters for the consultant question.
- AI result protections: read-only transaction, five-second statement timeout, and maximum 1,000 rows.
- Main reporting objects: batch P&L, collections aging, dashboard KPIs.
- Reference demo economics: ₹250,000 revenue - ₹40,000 venue - ₹3,000 marketing - ₹90,000 trainer = ₹117,000 profit.

## Statements you should not say

| Avoid this claim | Say this instead |
|---|---|
| “The system is event-sourced.” | “It is relational with an append-only audit log.” |
| “Historical P&L is replayed from the ledger.” | “Historical P&L uses effective timestamps on financial records.” |
| “AI calculates the profit.” | “PostgreSQL calculates profit; AI only queries and explains approved results.” |
| “The regex makes generated SQL secure.” | “The restricted database role is the security boundary; validation is an additional filter.” |
| “Every role is an RLS role.” | “There are six business roles and three restricted technical database roles.” |
| “The student balance is personal debt.” | “It can be a shared programme or batch balance.” |
| “There are no vulnerabilities.” | “Automated dependency and security checks passed at the time tested; security is continuously maintained.” |
| “It is enterprise-ready at any scale.” | “It is ready for a controlled pilot after deployment checks, with known enterprise hardening work.” |

## How to answer a question you do not know

Use this structure instead of guessing:

1. State the boundary: “That exact case is not implemented in the current scope.”
2. Connect it to what exists: “The present design already has transactions and audit events.”
3. Give the next design step: “I would add a background queue and an outbox table so the operation and delivery request commit atomically.”
4. Be honest: never invent a library, test result, or production guarantee.

## Five-minute rehearsal order

1. Say the 30-second problem statement without reading.
2. Explain why the batch is the profit centre.
3. Trace one form from browser to transaction to audit event.
4. Explain permissions versus RLS versus database roles.
5. Explain both AI pipelines and why they are different.
6. Explain idempotency using request ID, advisory lock, and stored result.
7. State two honest limitations and how you would fix them.

## Code map for revision

- Authentication: `web/src/lib/auth.ts`, `web/src/lib/password.ts`, `web/src/lib/auth-actions.ts`
- Permissions and transaction security: `web/src/lib/permissions.ts`, `web/src/lib/transaction.ts`, `web/src/lib/api-access.ts`
- Business writes and idempotency: `web/src/lib/actions.ts`, `web/src/lib/operations.ts`, `web/src/lib/demo.ts`
- Reporting queries: `web/src/lib/queries.ts`
- AI consultant: `web/src/lib/consultant.ts`, `web/src/lib/groq.ts`
- Student assistant: `web/src/lib/student-assistant.ts`
- Database design: `db/schema.sql`, `db/migrations/001_production_hardening.sql`, `db/migrations/002_auth_and_idempotency.sql`, `db/migrations/003_rls_and_rate_limits.sql`
- Verification: `web/scripts/validation-tests.js`, `web/scripts/integration-tests.js`, `web/scripts/role-browser-tests.py`, `web/scripts/audit-db.js`

## Final closing line

“Continuum's main contribution is not just putting six dashboards in one application. It creates a verifiable data chain from enquiry to delivery to money, then protects that chain with transactions, audit events, role-based access, database-level controls, and repeatable tests.”
