# Day 17 verification - queues and workers

WorkSphere now uses BullMQ over Redis for durable asynchronous email jobs. The
web process persists invitations and enqueues `invitation.email`; the separate
email worker validates current invitation state before calling the email
provider seam.

## Reliability policy

- Queue: `worksphere-email-v1`, with a version in the name for safe contract
  evolution.
- Job ID: `invitation-email-<invitationId>`, preventing duplicate jobs for the
  same invitation while retained.
- Retry: five attempts with exponential backoff starting at one second.
- Dead letter: exhausted jobs remain in BullMQ's failed set for inspection and
  retry; worker events emit allowlisted structured logs without tokens or email
  addresses.
- Worker idempotency: stale, accepted, revoked, expired, or token-mismatched
  invitation jobs become successful no-ops. The stable job ID is also passed to
  the provider seam as its idempotency key.
- Retention: successful jobs remain for one day (up to 1,000); failures are not
  automatically deleted.

The in-app mention notification remains in the originating database transaction
because it is core application state. Delivery side effects belong in queues.
The current provider seam is intentionally a no-op until an email vendor is
selected; provider implementations must honor the supplied idempotency key.

## Run locally

```sh
npm run infra:up
npm run dev
npm run worker
```

Run the web and worker commands in separate terminals. The worker shuts down
gracefully on `SIGINT`/`SIGTERM`.

## Verification

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

The queue tests cover deterministic enqueue identity, worker state validation,
provider idempotency propagation, and stale-job no-op behavior.
