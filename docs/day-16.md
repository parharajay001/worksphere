# Day 16 verification - Redis caching and rate limits

WorkSphere now uses an optional Redis connection for a shared organization
project-list cache and authentication rate-limit counters. Set `REDIS_URL` to
the Redis service; `npm run infra:up` starts PostgreSQL and Redis locally.
When Redis is unavailable, project reads fall back to PostgreSQL and auth
limits fall back to the existing process-local fixed window.

## Project cache

`GET /api/projects?organizationId=<uuid>` reports `cache` as `hit`, `miss`, or
`unavailable` for operational verification. Keys use
`worksphere:projects:v1:organization:<organizationId>` and expire after 30
seconds. Project creation, updates, and deletion invalidate the organization
key. Authorization is checked before cache reads, and each key is tenant
scoped. Cache values are JSON and project timestamps are revived as `Date`
instances before returning to callers.

## Rate limits

Login, registration, and password-reset request throttles use atomic Redis
`INCR` plus `EXPIRE` fixed windows with SHA-256 hashed scope keys. The window
is 60 seconds; limits remain 10 logins, 5 registrations, and 5 recovery
requests. `Retry-After` comes from Redis TTL. Redis failures retain the existing
in-process fallback, and raw email/IP values are not used as Redis key names.

## Verification

```sh
npm run infra:up
npm run test:cache
npm run test:db
npm run lint
npm run typecheck
npm run build
```

The cache integration suite verifies key scoping, miss/hit behavior, expiry
metadata, invalidation, and Redis-backed rate-limit enforcement. The browser
workflow checks project-list hits and invalidation after a project write.
