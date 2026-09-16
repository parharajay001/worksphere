import "server-only";
import { database } from "../../database/client.ts";
import {
  ANALYTICS_TTL_SECONDS,
  analyticsKey,
  getCachedJson,
  invalidateCache,
  setCachedJson,
} from "../../cache/cache.ts";
import { requirePermission } from "../authorization/guards.ts";

export type AnalyticsSnapshot = Awaited<ReturnType<typeof queryAnalytics>>;

async function queryAnalytics(organizationId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
  const sevenDaysAgo = new Date(now.getTime() - 6 * 86_400_000);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);
  const [projects, members, taskGroups, completedLast30, actors, events] =
    await Promise.all([
      database.project.count({ where: { organizationId } }),
      database.membership.count({ where: { organizationId } }),
      database.task.groupBy({
        by: ["status"],
        where: { project: { organizationId } },
        _count: { _all: true },
      }),
      database.task.count({
        where: {
          project: { organizationId },
          status: "DONE",
          updatedAt: { gte: thirtyDaysAgo },
        },
      }),
      database.activityEvent.findMany({
        where: {
          project: { organizationId },
          createdAt: { gte: thirtyDaysAgo },
        },
        distinct: ["actorId"],
        select: { actorId: true },
      }),
      database.activityEvent.findMany({
        where: {
          project: { organizationId },
          createdAt: { gte: sevenDaysAgo },
        },
        select: { createdAt: true },
      }),
    ]);
  const tasksByStatus = Object.fromEntries(
    ["TODO", "IN_PROGRESS", "REVIEW", "DONE"].map((status) => [
      status,
      taskGroups.find((group) => group.status === status)?._count._all ?? 0,
    ]),
  );
  const activityByDay = Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(sevenDaysAgo.getTime() + offset * 86_400_000);
    const key = day.toISOString().slice(0, 10);
    return {
      date: key,
      count: events.filter((event) =>
        event.createdAt.toISOString().startsWith(key),
      ).length,
    };
  });
  return {
    generatedAt: now.toISOString(),
    projects,
    members,
    activeUsers30d: actors.length,
    completedTasks30d: completedLast30,
    tasksByStatus,
    activityByDay,
  };
}

export async function getAnalytics(userId: string, organizationId: string) {
  await requirePermission(userId, organizationId, "organization:read");
  const key = analyticsKey(organizationId);
  const cached = await getCachedJson<AnalyticsSnapshot>(key);
  if (cached.state === "hit")
    return { analytics: cached.value, cache: "hit" as const };
  const analytics = await queryAnalytics(organizationId);
  const stored = await setCachedJson(key, analytics, ANALYTICS_TTL_SECONDS);
  return {
    analytics,
    cache: stored ? ("miss" as const) : ("unavailable" as const),
  };
}

export function invalidateAnalytics(organizationId: string) {
  return invalidateCache(analyticsKey(organizationId));
}
