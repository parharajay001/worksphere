# Day 1 — repository and app foundation

## Scope and decisions

- A standalone local Git repository at `worksphere/`, with `main` as the stable
  branch and documented short-lived feature branches.
- Next.js App Router with React, strict TypeScript, and a single Node.js API layer.
- A clean modular monolith (`app/`, `components/`, `config/`, `modules/`).
  Package extraction waits until reuse is proven.
- ESLint with Next.js/TypeScript rules and Prettier, plus editor and line-ending
  conventions and a dependency lockfile.
- Zod environment validation at startup/build; safe error messages and an
  idempotent setup helper.
- A responsive basic shell, an empty workspace, a custom 404, and a dynamic
  public liveness endpoint at `/api/health`.
- Local setup and verification commands in the README.

The six Day 1 checklist items are the acceptance scope. Database/ORM setup,
general API error conventions, authentication, Docker, and CI are deliberately
scheduled after this milestone.

## Verification

Verified locally on Windows with Node.js 22.22.3:

- `npm ci`: a clean dependency reinstall from the lockfile succeeded; npm
  reported zero known vulnerabilities at verification time.
- `npm run setup`: created `.env.local`; a second run preserved its contents.
- `npm run dev`: started successfully; the homepage and health endpoint both
  passed HTTP checks. Temporary verification servers were stopped afterward.
- Lint, Prettier checks, strict typechecking, and all four environment tests
  passed. The optimized Next.js production build passed.
- Production HTTP checks: `/` returned the app; `/api/health` returned HTTP 200
  and the expected JSON shape, a fresh timestamp, and `Cache-Control: no-store`.
  POST to health returned 405, and an unknown page returned 404.
- Headless Chromium at 1440×1000 and 390×844: local fonts loaded, no horizontal
  overflow or JavaScript runtime errors, functional keyboard skip link, and a
  working workspace anchor. The 404 recovery link returned to the overview.
  Desktop and mobile screenshots were visually reviewed.
- `next dev`, `next build`, and `next start` each rejected invalid environment
  configuration without echoing the supplied value.
- Git ignores `.env.local`, dependencies, and build output.

Browser smoke checks used the existing machine-local Playwright/Chromium
installation, without adding an end-to-end testing framework to the app.
Screenshots are temporary build artifacts in `.next/`, not committed assets.

## Remaining boundaries

This is a locally verified foundation. No remote, deployment, database,
authentication, tenant isolation, or business feature is claimed by Day 1.
The health route reports liveness, not dependency readiness. The README records
the ESLint 9 peer-dependency constraint for a future coordinated tooling update.
