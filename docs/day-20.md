# Day 20 verification - billing, entitlements, and usage

WorkSphere now has a provider-neutral SaaS billing foundation. Organizations
default to Free and may receive Pro or Team entitlements from verified billing
events.

## Plans and limits

| Plan | Active projects | Members | Chat messages/month |
| ---- | --------------: | ------: | ------------------: |
| Free |               3 |       5 |                 500 |
| Pro  |              25 |      50 |              10,000 |
| Team |       Unlimited |     500 |             100,000 |

Project creation locks the organization row and checks the active-project count
inside the same transaction, preventing concurrent limit bypass. Chat usage is
atomically incremented in a monthly UTC counter inside the message transaction;
an over-limit message and counter increment roll back together.

`GET /api/billing?organizationId=<uuid>` returns the authorized organization's
effective plan, provider subscription state, entitlements, and current usage.

## Provider abstraction and webhooks

`BillingProvider` defines customer creation, hosted checkout, and cancellation
without coupling domain services to a vendor SDK. `BillingSubscription` stores
provider/customer/subscription identifiers and lifecycle state.

`POST /api/billing/webhooks/:provider`:

1. reads a size-bounded raw request body;
2. verifies `x-worksphere-signature` with HMAC-SHA256 before parsing JSON;
3. strictly validates the event contract;
4. inserts a unique `(provider, externalEventId)` receipt;
5. upserts subscription state and marks the receipt processed in one
   transaction.

Retries return `duplicate: true` without applying state twice. Only a SHA-256
payload hash is retained, not the raw provider payload. Set a unique deployment
secret in `BILLING_WEBHOOK_SECRET`; the `.env.example` value is local-only.

## Verification

```sh
npm run db:deploy
npm test
npm run test:db
npm run typecheck
npm run lint
npm run build
```

Tests cover entitlement definitions, exact-byte signature verification, strict
webhook parsing, concurrent-safe Free project gating, subscription activation,
and duplicate webhook handling.
