# Day 2 — PostgreSQL and ORM

## Scope

- Local PostgreSQL with health checks and persistent storage.
- Prisma 7 configuration, generated client, and strict database environment validation.
- User, Account, Session, Organization, and Membership models.
- Versioned initial migration and a transactional, repeatable development seed.
- Server-only database singleton, bounded connection pool, and documented
  repository/service and migration conventions.

Database commands and setup are in the [README](../README.md). Model decisions
and lifecycle conventions are in [database.md](database.md).

## Verification

Verified locally on Windows with Node.js 22.22.3, Prisma 7.10.0, and the
PostgreSQL 17 Compose service:

- `npm run setup` added the missing database setting to the Day 1 environment
  file while preserving the existing application URL.
- `npm run db:setup` started a healthy PostgreSQL container, generated Prisma
  Client, applied the initial SQL migration, and seeded without manual DB edits.
- `npm run db:check` returned `status: ok`, with 3 users, 1 organization, and
  3 memberships. No accounts, session tokens, or login credentials were seeded.
- `npm run test:db` passed all 8 integration tests in a newly created database:
  empty-database migration, repeated migration/seed execution, preservation of
  seed edits, uniqueness, foreign keys, rollback, SQL checks, and cascades.
  The test's cleanup hook removed its disposable database.
- `npm run check` passed lint, formatting, schema validation, strict TypeScript,
  all 6 environment tests, and the optimized production build.
- npm reported zero known vulnerabilities after applying the documented
  Prisma CLI dependency overrides.
- Git ignores the local environment and generated database client.

The local PostgreSQL service is left running, with its data stored in the named
volume. Use `npm run db:stop` when finished; this preserves the data.

## Boundaries

No authentication endpoints, organization CRUD, access-control implementation,
or general API framework are introduced here. The database model prepares for
those milestones. `/api/health` remains a liveness probe; `db:check` verifies
database connectivity locally. Compose runs PostgreSQL only.
