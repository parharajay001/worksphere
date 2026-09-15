# WorkSphere

A multi-tenant project management and collaboration app, built as a modular
monolith. WorkSphere is the first project in the WorkSphere → KnowledgeOS →
MarketForge sequence. Later projects will reuse proven infrastructure patterns.

**Current milestone: Day 9 — invitations and teams.**

## Local setup

Prerequisites: Git, Docker with Compose (Docker Desktop on Windows), and Node.js
**22.14+ within 22.x, or 24.x**, with npm. Start Docker before database setup.
The development version is pinned in `.nvmrc`. On Windows, use `npm.cmd` in
PowerShell if execution policy blocks `npm.ps1`; no policy change is required.

From a fresh clone, open a terminal at this repository's root (`worksphere/`):

```sh
npm ci
npm run setup
npm run db:setup
npm run dev
```

Open <http://localhost:3000>. `setup` creates `.env.local`, or adds missing example
keys while preserving existing values. `db:setup` starts PostgreSQL, generates
Prisma Client, applies committed migrations, and runs the repeatable local seed.
The first database start downloads the PostgreSQL image. No provider account or
global Prisma CLI is needed. Stop the app with Ctrl+C; stop PostgreSQL with
`npm run db:stop` (data is preserved).

For a one-line first run in a shell that supports `&&`:

```sh
npm ci && npm run setup && npm run db:setup && npm run dev
```

In Windows PowerShell 5, run the four commands on separate lines using
`npm.cmd`. If port 3000 is busy, set `APP_URL=http://localhost:3001` in
`.env.local`, then run `npm run dev -- --port 3001`.

### Production build locally

```sh
npm run build
npm run start
```

This verifies the production server locally; cloud deployment is scheduled
for a later milestone. Both development and production use port 3000 by default.

## Commands

| Command                | Purpose                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `npm run setup`        | Create local environment configuration without overwriting it      |
| `npm run dev`          | Start the development server                                       |
| `npm run lint`         | Run Next.js/TypeScript lint rules, with zero warnings              |
| `npm run format`       | Format source and documentation                                    |
| `npm run format:check` | Verify formatting without editing files                            |
| `npm run typecheck`    | Generate Next.js route types and check strict TypeScript           |
| `npm test`             | Run environment, API, authentication, and RBAC unit tests          |
| `npm run test:auth`    | Verify registration, login, logout, sessions, and protected access |
| `npm run build`        | Create the production build                                        |
| `npm run start`        | Serve an existing production build                                 |
| `npm run check`        | Run lint, formatting, typecheck, tests, and build in sequence      |

### Database commands

`npm run test:api` verifies the built app's HTTP routes, request logs, and
database-failure behavior using temporary local production servers. Run
`npm run check` and `npm run db:up` first. See the [API reference](docs/api.md).

Authentication is available at `/login`, `/register`, and `/dashboard`.
Organization, tenant isolation, RBAC, invitations, and teams are documented in
the [Day 6](docs/day-06.md), [Day 7](docs/day-07.md), [Day 8](docs/day-08.md),
and [Day 9](docs/day-09.md) verification notes.

| Command                                 | Purpose                                                             |
| --------------------------------------- | ------------------------------------------------------------------- |
| `npm run db:setup`                      | Start PostgreSQL, generate client, apply migrations, seed demo data |
| `npm run db:up`                         | Start PostgreSQL and wait for its health check                      |
| `npm run db:stop`                       | Stop PostgreSQL while preserving its named volume                   |
| `npm run db:logs`                       | Show recent PostgreSQL logs                                         |
| `npm run db:generate`                   | Regenerate the type-safe database client                            |
| `npm run db:validate`                   | Validate Prisma schema and configuration                            |
| `npm run db:migrate -- --name <change>` | Create/apply a new migration in development                         |
| `npm run db:deploy`                     | Apply committed migrations without creating new ones                |
| `npm run db:status`                     | Check migration status                                              |
| `npm run db:seed`                       | Add missing demo records without resetting existing ones            |
| `npm run db:check`                      | Verify connectivity and report model counts                         |
| `npm run test:db`                       | Migrate and test a fresh disposable local database                  |

`check` includes schema validation but does not require a running database. Run
`npm run test:db` after `npm run db:up` to verify actual database behavior.
Development, builds, typechecking, and database tests generate Prisma Client
automatically. Generated code is ignored by Git.

**Upgrading from Day 1:** run `npm ci`, `npm run setup`, and `npm run db:setup`.
The setup helper adds `DATABASE_URL` without changing your existing `APP_URL`.

Run `npm run setup` before `check`. The build does not run lint implicitly;
the explicit commands follow the [Next.js installation guidance](https://nextjs.org/docs/app/getting-started/installation).
Commit `package-lock.json` and use `npm ci` for repeatable installs.

## Structure

```text
src/
  app/                 Next.js App Router pages, layouts, and HTTP routes
    api/health/        Public liveness endpoint
  components/          Shared presentation components
  config/              Typed environment validation
  database/            Server-only Prisma factory and development singleton
  generated/prisma/    Generated Prisma Client (ignored by Git)
  lib/api/             Request boundary, responses, typed errors, validation
  lib/logging/         Structured request completion logging
  modules/             Domain features, added on their scheduled days
    authorization/     Role and permission matrix plus server guards
    organizations/     Tenant-scoped services and repositories
    invitations/       Hashed invitation token lifecycle
    teams/             Organization-scoped teams
    notifications/     Email delivery abstraction
prisma/                Schema, versioned SQL migrations, and local seed
scripts/               Local setup helpers
tests/                 Focused foundation tests
docs/                  Engineering decisions and milestone records
```

Use one Next.js application with its Node.js API layer. Keep routes thin and
place future business logic in domain modules. Avoid shared packages until a
second application proves a stable interface. TypeScript uses `strict` and
`noUncheckedIndexedAccess`; `@/*` resolves to `src/*`.

The responsive shell includes an overview, a protected dashboard, an active
organization switcher, keyboard skip navigation, focus styles, reduced-motion
support, and a custom 404. Its fonts are served locally from installed packages.
Projects and tasks arrive in later milestones.

## Environment configuration

| Variable       | Required       | Meaning                                                          |
| -------------- | -------------- | ---------------------------------------------------------------- |
| `APP_URL`      | Yes            | Application HTTP(S) origin, e.g. `http://localhost:3000`         |
| `NODE_ENV`     | Set by Next.js | `development`, `test`, or `production`                           |
| `DATABASE_URL` | Yes            | PostgreSQL URL; `.env.example` matches the local Compose service |

Next.js loads environment files before `next.config.ts` validates them.
Development startup, builds, and production startup fail for missing or invalid
configuration. `APP_URL` must not contain credentials, a path, query, or fragment.
It records the configured application origin; it does not choose the listening
port. A deployed environment should use its HTTPS origin.

Validation errors show field names only. Environment files are ignored by Git
except `.env.example`. Keep server configuration out of client components; do
not add secrets with a `NEXT_PUBLIC_` prefix. Prisma CLI and database scripts
load the same environment files using `@next/env`. Provider settings arrive with
their integrations.

## Health endpoint

```sh
curl http://localhost:3000/api/health
```

Or in PowerShell: `Invoke-RestMethod http://localhost:3000/api/health`.

`GET /api/health` returns HTTP 200 with `Cache-Control: no-store`:

```json
{
  "data": {
    "status": "ok",
    "service": "worksphere",
    "timestamp": "2026-09-15T00:00:00.000Z"
  },
  "meta": { "requestId": "9c7abddb-a568-4cc2-8b4e-b7d5cbb63f21" }
}
```

The timestamp is generated for each request. This public endpoint checks
application liveness only and exposes no configuration or credentials.
Add `?check=database` for a minimal PostgreSQL connectivity check (200/503), or
run `npm run db:check` for local model counts. Health fields now live under
`data`; responses also include an `X-Request-ID` header matching `meta.requestId`.
See [API contracts, validation, errors, and logging](docs/api.md).

## Branching and contributions

`main` is the stable branch. Create short-lived branches from it:

```sh
git switch -c feat/day-03-api-foundation
```

Use `feat/<scope>`, `fix/<scope>`, or `chore/<scope>`. Keep each branch focused on
one milestone, run `npm run check`, and merge through a reviewed pull request
once a remote exists. Use commit subjects such as
`chore: establish day 1 foundation`. No `develop` branch is needed.

Feature branches are merged into `main` through pull requests. Cloud deployment
remains a later milestone. See [Day 1](docs/day-01.md), [Day 2](docs/day-02.md),
[Day 3](docs/day-03.md), [Day 4](docs/day-04.md), [Day 5](docs/day-05.md),
[Day 6](docs/day-06.md), [Day 7](docs/day-07.md), [Day 8](docs/day-08.md), and
[database design and migration conventions](docs/database.md).

## Next milestone

Day 10 adds projects. Project CRUD, Redis, workers, full application
containerization, and CI/CD remain on their scheduled days. The Compose file
runs local PostgreSQL only.

### Tooling compatibility

ESLint 9 is used because the React and accessibility plugins bundled by
`eslint-config-next` currently declare support through ESLint 9. npm may print
its upstream end-of-support notice. Upgrade the lint toolchain together once
those plugins support ESLint 10; do not bypass their peer constraints.

Prisma CLI, Client, and the PostgreSQL adapter use stable 7.10.0. Scoped npm
overrides update Prisma CLI's `deepmerge-ts` to 8.0.1 and `mysql2` to 3.24.0 to
resolve upstream advisories. WorkSphere's Prisma config uses plain objects,
so the Map-merging change in deepmerge-ts 8 does not affect it; the application
uses PostgreSQL. Migration, generation, seed, and build checks validate this
combination. Revisit the overrides when upgrading Prisma. See the
[deepmerge-ts fix](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0)
and [MySQL driver release](https://github.com/sidorares/node-mysql2/releases/tag/v3.24.0).
