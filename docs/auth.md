# Authentication foundation

Day 4 adds credentials authentication behind the existing API boundary. The
module is server-only and keeps password hashing, session storage, and cookie
policy out of route components.

## Flows

| Request                   | Result                                                                        |
| ------------------------- | ----------------------------------------------------------------------------- |
| `POST /api/auth/register` | Validates name/email/password, creates a user, creates a session, returns 201 |
| `POST /api/auth/login`    | Validates credentials, creates a session, returns 200                         |
| `POST /api/auth/logout`   | Revokes the presented session and expires the cookie                          |
| `GET /api/auth/me`        | Returns the authenticated safe user projection or 401                         |
| `GET /dashboard`          | Server-side protected page; redirects anonymous users to `/login`             |

Requests use the Day 3 JSON envelope and correlation headers. Invalid request
shape is `VALIDATION_ERROR`; duplicate email is `CONFLICT`; invalid credentials
always use the generic `UNAUTHENTICATED` response. Registration creates a user
only; organizations and owner membership arrive in the organization milestone.

## Password storage

Passwords use Node's asynchronous `scrypt` with a random 16-byte salt and a
64-byte derived key. The stored format is `scrypt$<salt>$<derived-key>` using
base64url encoding. Verification compares derived keys with `timingSafeEqual`.
Password input is 12–128 characters and is never logged, returned, or persisted
as plaintext. Spaces remain valid passphrase characters. Email verification,
reset flows, breached-password checks, and cost tuning are Day 5 work.

## Sessions and cookies

Session tokens are 32 random bytes encoded as base64url. Only a SHA-256 hex hash
is stored in PostgreSQL; raw tokens exist in the HttpOnly cookie operation only.
The cookie is `worksphere_session`, scoped to `/`, `SameSite=Lax`, and `Secure`
in production. It has a 30-day max age and matching server-side expiry.

`getSessionUser` hashes the presented token, checks its record and expiry, and
returns only `id`, `name`, `email`, and `emailVerifiedAt`. Expired sessions are
deleted opportunistically. `clearSession` deletes the matching record and expires
the cookie. Logout is safe to repeat and never trusts a client-supplied user ID.

## Protected access and UI

The dashboard checks authentication on the server and redirects anonymous users
to `/login`; the `/api/auth/me` route applies the same check. It currently shows
the safe identity projection and a sign-out form. Organization data arrives later.
Login and registration use same-origin API routes, generic server messages,
pending-state buttons, Next.js router navigation, password autocomplete hints,
and a responsive self-hosted-font layout. No password enters a URL or local
storage.

## Error and abuse boundaries

Auth routes inherit Day 3's 64 KiB JSON limit, strict unknown-field checks,
generic validation details, request IDs, safe logs, and opaque internal errors.
Credentials never appear in errors or logs. Rate limiting, CSRF hardening,
email verification/reset, and brute-force controls are Day 5 work; a valid
session is not organization authorization.

## Verification

```sh
npm run check
npm run db:up
npm run test:auth
```

`test:auth` starts a temporary production server against the configured local
database, exercises registration, duplicate conflict, cookie-backed current-user,
logout revocation, login, generic bad credentials, and validation, then removes
its random test user. It does not reset the development database or retain a
session. Unit tests cover password salts, verification, schema normalization,
and weak/unknown input.
