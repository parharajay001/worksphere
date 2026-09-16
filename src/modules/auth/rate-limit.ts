import "server-only";
import { createHash } from "node:crypto";
import { AppError } from "../../lib/api/errors.ts";
import { getRedisClient } from "../../cache/redis-client.ts";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const LIMITS = { login: 10, register: 5, recovery: 5 } as const;

export async function enforceAuthRateLimit(
  scope: keyof typeof LIMITS,
  key: string,
) {
  const now = Date.now();
  const id = `${scope}:${key}`;
  const redis = await getRedisClient();
  if (redis) {
    const digest = createHash("sha256").update(id).digest("hex");
    try {
      const result = (await redis.eval(
        "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return {count, redis.call('TTL', KEYS[1])}",
        {
          keys: [`worksphere:rate-limit:v1:${digest}`],
          arguments: [String(WINDOW_MS / 1000)],
        },
      )) as [number, number];
      const [count, ttl] = result;
      if (count > LIMITS[scope]) {
        throw new AppError("RATE_LIMITED", {
          headers: { "Retry-After": String(Math.max(ttl, 1)) },
        });
      }
      return;
    } catch (error) {
      if (error instanceof AppError) throw error;
    }
  }
  const current = buckets.get(id);
  const bucket =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + WINDOW_MS }
      : current;
  bucket.count += 1;
  buckets.set(id, bucket);
  if (bucket.count > LIMITS[scope]) {
    throw new AppError("RATE_LIMITED", {
      headers: {
        "Retry-After": String(Math.ceil((bucket.resetAt - now) / 1000)),
      },
    });
  }
}

export function clearAuthRateLimits() {
  buckets.clear();
}
