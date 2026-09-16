# Day 21 verification - analytics and immutable audit logs

WorkSphere now separates collaboration activity from a security-oriented audit
ledger and exposes tenant-scoped operational analytics.

## Audit ledger

Sensitive organization, invitation, and subscription mutations append
allowlisted audit events in the same database transaction as the state change.
Audit records retain tenant and actor identifiers without foreign keys so later
organization/user deletion cannot cascade-delete or rewrite history.

PostgreSQL `BEFORE UPDATE` and `BEFORE DELETE` triggers reject every mutation of
an `AuditEvent`. Only owners and admins (`members:manage`) can page through
`GET /api/audit?organizationId=<uuid>`; cross-tenant cursors are rejected.
Secrets, invitation tokens, email addresses, and webhook payloads are never
placed in audit metadata.

## Analytics

The organization dashboard reports:

- projects and members;
- active users over 30 days;
- tasks by status and tasks completed over 30 days;
- seven-day activity counts.

Aggregates are cached in Redis for 60 seconds under versioned tenant keys.
Project and task mutations invalidate the affected organization cache. Every
analytics read authorizes membership before accessing Redis, preventing a cache
key from becoming an authorization bypass.

`GET /api/analytics/export?organizationId=<uuid>` returns a real CSV response
with request correlation headers. Cells are quoted and spreadsheet-formula
prefixes are neutralized.

## Verification

```sh
npm run db:deploy
npm test
npm run test:db
npm run typecheck
npm run lint
npm run build
```

Tests cover strict query contracts, tenant cache keys, raw CSV responses,
cross-tenant analytics denial, KPI aggregation, sensitive audit generation, and
database-level audit update/delete rejection.
