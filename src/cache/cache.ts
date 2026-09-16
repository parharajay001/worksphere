import "server-only";
import { getRedisClient } from "./redis-client.ts";

export type CacheState = "hit" | "miss" | "unavailable";
export const PROJECT_LIST_TTL_SECONDS = 30;
export const ANALYTICS_TTL_SECONDS = 60;

export function projectListKey(organizationId: string) {
  return `worksphere:projects:v1:organization:${organizationId}`;
}

export function analyticsKey(organizationId: string) {
  return `worksphere:analytics:v1:organization:${organizationId}`;
}

export async function getCachedJson<T>(key: string) {
  const client = await getRedisClient();
  if (!client) return { value: null, state: "unavailable" as const };
  try {
    const raw = await client.get(key);
    if (!raw) return { value: null, state: "miss" as const };
    try {
      return { value: JSON.parse(raw) as T, state: "hit" as const };
    } catch {
      await client.del(key);
      return { value: null, state: "miss" as const };
    }
  } catch {
    return { value: null, state: "unavailable" as const };
  }
}

export async function setCachedJson<T>(
  key: string,
  value: T,
  ttlSeconds: number,
) {
  const client = await getRedisClient();
  if (!client) return false;
  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return true;
  } catch {
    return false;
  }
}

export async function invalidateCache(key: string) {
  const client = await getRedisClient();
  if (!client) return false;
  try {
    await client.del(key);
    return true;
  } catch {
    return false;
  }
}
