# WorkSphere

A multi-tenant project management and collaboration app, built as a modular
monolith. WorkSphere is the first project in the WorkSphere → KnowledgeOS →
MarketForge sequence. Later projects will reuse proven infrastructure patterns.

**Current milestone: Day 1 — repository and app foundation.**

## Local setup

Prerequisites: Git and Node.js **22.14+ within 22.x, or 24.x**, with npm.
The development version is pinned in `.nvmrc`. On Windows, use `npm.cmd` in
PowerShell if execution policy blocks `npm.ps1`; no policy change is required.

From a fresh clone, open a terminal at this repository's root (`worksphere/`):

```sh
npm ci
npm run setup
npm run dev
```

Open <http://localhost:3000>. `setup` copies `.env.example` to `.env.local` only
when the local file does not exist. Re-running it preserves your configuration.
No database, Docker, account, provider credentials, or global CLI is needed.
Stop the server with Ctrl+C.

For a one-line first run in a shell that supports `&&`:

```sh
npm ci && npm run setup && npm run dev
```

In Windows PowerShell 5, run the three commands on separate lines using
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

| Command                | Purpose                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `npm run setup`        | Create local environment configuration without overwriting it    |
| `npm run dev`          | Start the development server                                     |
| `npm run lint`         | Run Next.js/TypeScript lint rules, with zero warnings            |
| `npm run format`       | Format source and documentation                                  |
| `npm run format:check` | Verify formatting without editing files                          |
| `npm run typecheck`    | Generate Next.js route types and check strict TypeScript         |
| `npm test`             | Run focused environment-validation tests with Node's test runner |
| `npm run build`        | Create the production build                                      |
| `npm run start`        | Serve an existing production build                               |
| `npm run check`        | Run lint, formatting, typecheck, tests, and build in sequence    |

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
  modules/             Domain features, added on their scheduled days
scripts/               Local setup helpers
tests/                 Focused foundation tests
docs/                  Engineering decisions and milestone records
```

Use one Next.js application with its Node.js API layer. Keep routes thin and
place future business logic in domain modules. Avoid shared packages until a
second application proves a stable interface. TypeScript uses `strict` and
`noUncheckedIndexedAccess`; `@/*` resolves to `src/*`.

The responsive shell includes an overview, an empty workspace, keyboard skip
navigation, focus styles, reduced-motion support, and a custom 404. Its fonts
are served locally from installed packages. There is no fake project data or
working project creation yet.

## Environment configuration

| Variable   | Required       | Meaning                                                  |
| ---------- | -------------- | -------------------------------------------------------- |
| `APP_URL`  | Yes            | Application HTTP(S) origin, e.g. `http://localhost:3000` |
| `NODE_ENV` | Set by Next.js | `development`, `test`, or `production`                   |

Next.js loads environment files before `next.config.ts` validates them.
Development startup, builds, and production startup fail for missing or invalid
configuration. `APP_URL` must not contain credentials, a path, query, or fragment.
It records the configured application origin; it does not choose the listening
port. A deployed environment should use its HTTPS origin.

Validation errors show field names only. Environment files are ignored by Git
except `.env.example`. Keep server configuration out of client components; do
not add secrets with a `NEXT_PUBLIC_` prefix. Add database and provider settings
only when those integrations are introduced.

## Health endpoint

```sh
curl http://localhost:3000/api/health
```

Or in PowerShell: `Invoke-RestMethod http://localhost:3000/api/health`.

`GET /api/health` returns HTTP 200 with `Cache-Control: no-store`:

```json
{
  "status": "ok",
  "service": "worksphere",
  "timestamp": "2026-09-15T00:00:00.000Z"
}
```

The timestamp is generated for each request. This public endpoint checks
application liveness only and exposes no configuration or credentials.
Database/Redis readiness checks arrive with those integrations.

## Branching and contributions

`main` is the stable branch. Create short-lived branches from it:

```sh
git switch -c feat/day-02-postgresql
```

Use `feat/<scope>`, `fix/<scope>`, or `chore/<scope>`. Keep each branch focused on
one milestone, run `npm run check`, and merge through a reviewed pull request
once a remote exists. Use commit subjects such as
`chore: establish day 1 foundation`. No `develop` branch is needed.

The repository is initialized locally; no remote or hosting deployment is
configured. See [Day 1 evidence and boundaries](docs/day-01.md).

## Next milestone

Day 2 adds PostgreSQL, the ORM, initial identity/organization models, migrations,
and seeding. Day 3 adds the general API validation/error/logging conventions.
Authentication, tenancy, RBAC, project CRUD, Redis, workers, Docker, and CI/CD
remain on their scheduled days.

### Tooling compatibility

ESLint 9 is used because the React and accessibility plugins bundled by
`eslint-config-next` currently declare support through ESLint 9. npm may print
its upstream end-of-support notice. Upgrade the lint toolchain together once
those plugins support ESLint 10; do not bypass their peer constraints.
