# Day 23 — Testing pass

## Coverage completed

- **Unit and contract tests:** 55 tests cover authentication, password hashing,
  RBAC, validation, API errors, request security, rate limiting, cache behavior,
  billing signatures, queue idempotency, realtime contracts, and task/board
  rules.
- **Database integration tests:** 23 tests run against randomly named,
  disposable PostgreSQL databases. Each database starts empty, receives the real
  migrations, exercises service transactions and constraints, and is dropped
  after the suite.
- **End-to-end tests:** 26 Playwright scenarios cover registration and recovery,
  workspace/team/project/task workflows, comments, Kanban, search, responsive
  layouts, and read-only/forbidden paths against the production build.

## Reliability and permission findings

The browser suite now gives each account-creation flow an isolated client key,
so tests do not accidentally exhaust another scenario's production-like auth
rate limit. Playwright uses two workers because all scenarios intentionally
share one local application server and PostgreSQL instance.

The pass also found a real read-only path defect: a Viewer could read a project
and its board, but server rendering still requested the admin-only organization
member directory. The project page now fetches that directory only for roles
that can manage projects; read-only users receive the bounded assignee list.

Browser assertions use stable, user-visible locators and authenticated API
contexts transfer their session cookies directly when a test is about
authorization rather than the login form. This keeps failures attributable to
the behavior under test.

## Clean-database strategy

`npm run test:db` refuses non-loopback and production database targets. Every
suite creates a `worksphere_test_<uuid>` database, deploys migrations from
scratch, and removes only that verified database in teardown. Coverage includes
tenant isolation, RBAC failures, task and Kanban transactions, concurrent stale
updates, rollback behavior, comments and mentions, chat, billing idempotency,
analytics, immutable audit records, constraints, and repeatable seeds.

## Verification

```sh
npm test             # 55 passed
npm run test:db      # 23 passed in four disposable databases
npm run test:e2e     # 26 passed against the production build
npm run typecheck
npm run format:check
npm run build
```
