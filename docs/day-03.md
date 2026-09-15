# Day 3 — API and validation foundation

## Scope

- Concrete route → service → repository flow in the health module.
- Zod validation for query, route parameters, and bounded JSON bodies.
- Consistent success/error JSON envelopes and HTTP semantics.
- Typed application errors with safe public messages.
- Request IDs and structured completion logs with an explicit field allowlist.
- API 404/405 handling and tests for successful and failing requests.

The [API reference](api.md) documents contracts, examples, compatibility changes,
and reuse conventions.

## Verification

Verified locally on Windows with Node.js 22.22.3, Next.js 16.3.5, and the
existing PostgreSQL development service:

- `npm run check` passed lint, formatting, Prisma schema validation, strict
  TypeScript, all 20 unit tests (14 API and 6 environment tests), and the
  optimized production build.
- API unit tests covered success/error envelopes, safe exception handling,
  serialization failures, HEAD/204 behavior, request-ID generation and concurrent
  isolation, log field filtering, logging failure handling, async validation,
  duplicate/unknown query keys, JSON media types, malformed/invalid UTF-8 bodies,
  actual streamed byte limits, and validation before service/repository work.
- `npm run test:api` passed against temporary production servers: homepage,
  liveness, real PostgreSQL connectivity, validation errors, API 404/405,
  HEAD/OPTIONS, correlation headers/body/logs, concurrent requests, and exclusion
  of credentials, payloads, and raw URL values from application request logs.
- A second server pointed at an unavailable local database returned a safe 503
  for `?check=database`, while default liveness continued returning 200.
- The smoke script stopped its own temporary servers. The development database
  remained healthy and running, and its data was not modified.
- No new dependencies or database migrations were needed.

The health response now wraps its former fields under `data` and includes
`meta.requestId`, matching the API-wide envelope. This compatibility change is
documented in the README and API reference.

## Boundaries

Day 4 authentication and subsequent tenancy/RBAC work remain pending. No
business-data routes or mutation endpoints were introduced. The optional
database probe establishes the real persistence path without exposing records.
The UI and database schema are unchanged.
