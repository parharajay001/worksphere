import "server-only";
import { AppError } from "../../lib/api/errors.ts";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const LIMITS = { login: 10, register: 5, recovery: 5 } as const;

export function enforceAuthRateLimit(scope: keyof typeof LIMITS, key: string) {
  const now = Date.now();
  const id = `${scope}:${key}`;
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
