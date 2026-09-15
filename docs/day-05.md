# Day 5 verification — authentication hardening

Day 5 adds one-time, hashed authentication tokens for email verification and
password reset. Tokens expire (24 hours for verification, one hour for reset),
are consumed once, and password reset revokes every existing session. Recovery
requests always return the same response whether an email exists, preventing
account enumeration.

Sensitive endpoints use a fixed-window limiter keyed by client address and
normalized email. It is an in-process local fallback; Day 16 will provide
shared Redis-backed limits across instances. 429 responses include `Retry-After`.

## Routes

| Route                                   | Purpose                                   |
| --------------------------------------- | ----------------------------------------- |
| `POST /api/auth/verify-email`           | Consume a verification token              |
| `POST /api/auth/password-reset/request` | Start a generic reset request             |
| `POST /api/auth/password-reset`         | Consume a reset token and rotate password |

Raw tokens are never stored. Registration and reset requests issue tokens for
the future email delivery adapter; no provider credentials are required locally.
Session cookies remain HttpOnly, SameSite=Lax, Secure in production, root scoped,
30 days maximum age, and high priority.

## Threat assumptions

- Email delivery and mailbox security are trusted for token possession.
- Token hashes, expiry, single-use consumption, and session revocation limit replay.
- In-process rate limits do not coordinate between replicas; Redis is required before horizontal scaling.
- Generic recovery responses and credential errors avoid account enumeration.

Validation and brute-force behavior are covered by `tests/auth.test.ts`.
