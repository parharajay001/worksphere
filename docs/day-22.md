# Day 22 — Security pass

## Mutation authorization review

Every HTTP mutation enters a service with an authenticated user ID. The review
confirmed the following ownership checks at the write boundary:

| Area                                       | Authorization boundary                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Organizations and active organization      | membership plus `organization:update` or `organization:delete`; active selection requires membership |
| Invitations, teams, and project membership | `members:manage`                                                                                     |
| Projects, tasks, and board moves           | organization/project lookup plus `projects:manage` or `tasks:manage`                                 |
| Comments                                   | project access; updates/deletes require author ownership or management permission                    |
| Notifications and chat read state          | recipient/conversation access is included in the update predicate                                    |
| Chat messages                              | project/team scope access before quota consumption and creation                                      |
| Billing webhooks                           | provider allowlist, HMAC verification, event idempotency, and tenant lookup                          |

Tenant-scoped lookups return `NOT_FOUND` where exposing resource existence
would leak cross-tenant information.

## Browser and transport protections

- Unsafe API requests reject an explicitly cross-site `Origin` or
  `Sec-Fetch-Site`. Requests without browser origin metadata remain supported
  for same-site server actions and non-browser clients.
- Signed billing webhooks explicitly bypass CSRF checking because they are
  authenticated with their raw-body HMAC signature.
- Mutation routes share a Redis-backed 120 requests/minute route-and-client
  limiter, with a process-local fallback when Redis is unavailable. Existing
  stricter login, registration, and recovery limits remain in force.
- Application responses set CSP, clickjacking, MIME-sniffing, referrer,
  permissions, and opener-isolation headers. CORS is intentionally not enabled;
  the browser API is same-origin only.

## Inputs, uploads, secrets, and logs

- JSON bodies are content-type checked, UTF-8 decoded, capped at 64 KiB, and
  validated with strict Zod schemas. Query duplicates and unknown keys fail.
- The future chat upload boundary only accepts PDF, common web images, and text;
  metadata is limited to 10 MiB and filenames reject traversal separators and
  control characters. Object storage must still verify file signatures and
  generate storage keys server-side before this hook is activated.
- Environment parsing reports invalid field names only. Request logging uses an
  explicit allowlist and excludes URLs, headers, cookies, bodies, exception
  messages, stack traces, tokens, and database errors.

## Verification

```sh
npm test
npm run test:db
npm run typecheck
npm run lint
npm run format:check
npm run build
```
