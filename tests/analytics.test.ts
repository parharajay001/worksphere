import assert from "node:assert/strict";
import { test } from "node:test";
import { analyticsKey } from "../src/cache/cache.ts";
import { analyticsQuerySchema } from "../src/modules/analytics/analytics.schemas.ts";
import { auditQuerySchema } from "../src/modules/audit/audit.schemas.ts";

const organizationId = "20000000-0000-4000-8000-000000000001";

test("analytics cache keys are versioned and tenant scoped", () => {
  assert.equal(
    analyticsKey(organizationId),
    `worksphere:analytics:v1:organization:${organizationId}`,
  );
});

test("analytics and audit queries reject injected or unbounded input", () => {
  assert.equal(
    analyticsQuerySchema.safeParse({ organizationId }).success,
    true,
  );
  assert.equal(
    analyticsQuerySchema.safeParse({ organizationId, tenantId: organizationId })
      .success,
    false,
  );
  assert.equal(auditQuerySchema.parse({ organizationId }).limit, 50);
  assert.equal(
    auditQuerySchema.safeParse({ organizationId, limit: "101" }).success,
    false,
  );
  assert.equal(
    analyticsQuerySchema.safeParse({
      organizationId,
      from: "2026-09-30",
      to: "2026-09-01",
    }).success,
    false,
  );
  assert.equal(
    auditQuerySchema.safeParse({
      organizationId,
      action: "project.created",
      from: "2026-09-01",
      to: "2026-09-30",
    }).success,
    true,
  );
});
