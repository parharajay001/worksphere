import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import {
  getCachedJson,
  invalidateCache,
  projectListKey,
  setCachedJson,
} from "../src/cache/cache.ts";
import { closeRedisClient, getRedisClient } from "../src/cache/redis-client.ts";
import { AppError } from "../src/lib/api/errors.ts";
import { enforceAuthRateLimit } from "../src/modules/auth/rate-limit.ts";

after(async () => closeRedisClient());

test("project cache uses organization-scoped keys", () => {
  const first = projectListKey(randomUUID());
  const second = projectListKey(randomUUID());
  assert.notEqual(first, second);
  assert.match(first, /^worksphere:projects:v1:organization:/);
});

test("Redis cache can miss, hit, and invalidate", async (context) => {
  const client = await getRedisClient();
  if (!client) {
    context.skip("Redis is unavailable; start it with npm run infra:up.");
    return;
  }

  const key = `worksphere:test:v1:${randomUUID()}`;
  try {
    assert.equal((await getCachedJson(key)).state, "miss");
    assert.equal(await setCachedJson(key, { value: "cached" }, 5), true);
    assert.deepEqual(await getCachedJson(key), {
      value: { value: "cached" },
      state: "hit",
    });
    assert.ok((await client.ttl(key)) > 0);
    assert.equal(await invalidateCache(key), true);
    assert.equal((await getCachedJson(key)).state, "miss");
  } finally {
    await client.del(key);
  }
});

test("Redis auth rate limits are shared fixed-window counters", async (context) => {
  const client = await getRedisClient();
  if (!client) {
    context.skip("Redis is unavailable; start it with npm run infra:up.");
    return;
  }

  const key = `cache-test-${randomUUID()}`;
  for (let attempt = 0; attempt < 10; attempt += 1)
    await enforceAuthRateLimit("login", key);
  await assert.rejects(
    enforceAuthRateLimit("login", key),
    (error: unknown) =>
      error instanceof AppError && error.code === "RATE_LIMITED",
  );
});
