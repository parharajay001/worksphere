# Day 18 verification - authenticated realtime collaboration

WorkSphere now runs Socket.IO as a separate gateway process. Next.js remains the
authoritative REST and persistence layer; Redis pub/sub carries bounded change
events to the gateway after database transactions commit.

## Security and tenancy

- The gateway authenticates the existing HTTP-only `worksphere_session` cookie
  against the session table during the Socket.IO handshake.
- Every connection automatically joins only its server-derived user room.
- Clients may request organization or project rooms, but the gateway validates
  current organization membership and resolves a project's organization from
  PostgreSQL. Client-supplied organization/project relationships are never
  trusted.
- Zod validates join requests and Redis event envelopes with strict schemas.
  Socket payloads contain identifiers and actions, not arbitrary database rows.
- Cross-tenant and malformed room requests receive `{ ok: false }` and never
  join a room.

## Delivery model

Task creates/updates/deletes/moves, comment creates/updates/deletes, and new
mention notifications publish events after persistence succeeds. The browser
uses those events as invalidation signals and refetches authorized REST data.
Redis or gateway downtime never rolls back a successful mutation; realtime is a
best-effort acceleration over the authoritative API.

The Socket.IO client uses WebSocket transport, reconnects with bounded backoff,
and rejoins its requested rooms after every successful reconnect.

## Run locally

```sh
npm run infra:up
npm run dev
npm run realtime
```

Use separate terminals for the web app and realtime gateway. The defaults are
`APP_URL=http://localhost:3000`, `NEXT_PUBLIC_REALTIME_URL=http://localhost:3001`,
and `REALTIME_PORT=3001`.

## Verification

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

The realtime suite covers cookie parsing, strict message contracts,
organization room authorization, project-to-organization resolution, and
explicit cross-tenant denial.
