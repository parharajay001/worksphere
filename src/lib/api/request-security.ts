import "server-only";
import { createHash } from "node:crypto";
import { AppError } from "./errors.ts";
import { getRedisClient } from "../../cache/redis-client.ts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const WINDOW_SECONDS = 60;
const MUTATION_LIMIT = 120;
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function expectedOrigin(request: Request) {
  const configured = process.env.APP_URL;
  if (configured && URL.canParse(configured)) return new URL(configured).origin;
  return new URL(request.url).origin;
}

export function enforceSameOrigin(request: Request) {
  if (SAFE_METHODS.has(request.method)) return;
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new AppError("FORBIDDEN");
  const origin = request.headers.get("origin");
  if (origin && origin !== expectedOrigin(request))
    throw new AppError("FORBIDDEN");
}

function clientKey(request: Request) {
  const candidate =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return /^[a-f0-9:.]{1,64}$/i.test(candidate) ? candidate : "unknown";
}

export async function enforceMutationRateLimit(
  request: Request,
  route: string,
) {
  if (SAFE_METHODS.has(request.method)) return;
  const identity = `${route}:${clientKey(request)}`;
  const digest = createHash("sha256").update(identity).digest("hex");
  const redis = await getRedisClient();
  if (redis) {
    try {
      const [count, ttl] = (await redis.eval(
        "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return {count, redis.call('TTL', KEYS[1])}",
        {
          keys: [`worksphere:rate-limit:mutation:v1:${digest}`],
          arguments: [String(WINDOW_SECONDS)],
        },
      )) as [number, number];
      if (count > MUTATION_LIMIT)
        throw new AppError("RATE_LIMITED", {
          headers: { "Retry-After": String(Math.max(ttl, 1)) },
        });
      return;
    } catch (error) {
      if (error instanceof AppError) throw error;
    }
  }

  const now = Date.now();
  const current = buckets.get(identity);
  const bucket =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + WINDOW_SECONDS * 1000 }
      : current;
  bucket.count += 1;
  buckets.set(identity, bucket);
  if (bucket.count > MUTATION_LIMIT)
    throw new AppError("RATE_LIMITED", {
      headers: {
        "Retry-After": String(Math.ceil((bucket.resetAt - now) / 1000)),
      },
    });
}

export function clearMutationRateLimits() {
  buckets.clear();
}
