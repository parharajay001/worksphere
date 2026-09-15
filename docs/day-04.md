# Day 4 — Authentication

## Scope

- Registration, login, logout, and current-user endpoints.
- Asynchronous scrypt password hashing with random salts and timing-safe verify.
- Opaque random session tokens, SHA-256 token hashes, expiry, revocation, and
  secure HttpOnly cookies.
- Server-side protected dashboard route and responsive login/register UI.
- Generic credential errors, safe user projections, and no secret-bearing logs.

See the [authentication reference](auth.md) for flows, session policy, and
security boundaries.

## Verification

Verified locally on Windows with Node.js 22.22.3, Next.js 16.3.5, Prisma 7.10.0,
and the local PostgreSQL service:

- `npm run check` passed lint, formatting, Prisma schema validation, strict
  TypeScript, all 22 unit tests, and the optimized production build.
- Unit tests covered salted scrypt hashes, incorrect-password handling,
  credential normalization, weak/unknown input, and the existing API foundation.
- `npm run test:auth` passed against a temporary production server: registration,
  duplicate-email conflict, HttpOnly session cookie, current-user lookup, logout
  revocation, login, generic bad credentials, and validation. Its random test
  user was removed in cleanup; the development database was not reset.
- The protected dashboard redirects anonymous users server-side to `/login` and
  renders only the safe user projection after authentication.

The session cookie is secure in production, SameSite=Lax, HttpOnly, scoped to `/`,
and expires after 30 days. Raw tokens and passwords are excluded from responses
and logs. Email verification, reset, rate limiting, and CSRF hardening remain
Day 5 boundaries.

## Boundaries

Email verification, password reset, rate limiting, brute-force controls, CSRF
hardening, and organization membership authorization remain scheduled for later
days. Registration does not create an organization until Day 6.
