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
import type { z } from "zod";
import type { analyticsQuerySchema } from "./analytics.schemas.ts";

export type AnalyticsSnapshot = Awaited<ReturnType<typeof queryAnalytics>>;
type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

function dayStart(value: string | undefined, fallback: Date) {
  const date = value ? new Date(`${value}T00:00:00.000Z`) : fallback;
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

async function queryAnalytics(
  organizationId: string,
  query: Omit<AnalyticsQuery, "organizationId"> = {},
) {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 29 * 86_400_000);
  const from = dayStart(query.from, defaultFrom);
  const requestedTo = dayStart(query.to, now);
  const to = new Date(requestedTo.getTime() + 86_400_000 - 1);
  const rangeDays = Math.min(
    90,
    Math.max(
      1,
      Math.floor((requestedTo.getTime() - from.getTime()) / 86_400_000) + 1,
    ),
  );
  const projectWhere = {
    organizationId,
    ...(query.projectId ? { id: query.projectId } : {}),
    ...(query.teamId ? { teamId: query.teamId } : {}),
  };
  const [
    projects,
    members,
    taskGroups,
    completedInRange,
    actors,
    events,
    completedTasks,
  ] = await Promise.all([
    database.project.count({ where: projectWhere }),
    database.membership.count({ where: { organizationId } }),
    database.task.groupBy({
      by: ["status"],
      where: { project: projectWhere },
      _count: { _all: true },
    }),
    database.task.count({
      where: {
        project: projectWhere,
        status: "DONE",
        updatedAt: { gte: from, lte: to },
      },
    }),
    database.activityEvent.findMany({
      where: {
        project: projectWhere,
        createdAt: { gte: from, lte: to },
      },
      distinct: ["actorId"],
      select: { actorId: true },
    }),
    database.activityEvent.findMany({
      where: {
        project: projectWhere,
        createdAt: { gte: from, lte: to },
      },
      select: {
        createdAt: true,
        actorId: true,
        project: { select: { team: { select: { id: true, name: true } } } },
      },
    }),
    database.task.findMany({
      where: {
        project: projectWhere,
        status: "DONE",
        updatedAt: { gte: from, lte: to },
      },
      select: { updatedAt: true },
    }),
  ]);
  const tasksByStatus = Object.fromEntries(
    ["TODO", "IN_PROGRESS", "REVIEW", "DONE"].map((status) => [
      status,
      taskGroups.find((group) => group.status === status)?._count._all ?? 0,
    ]),
  );
  const activityByDay = Array.from({ length: rangeDays }, (_, offset) => {
    const day = new Date(from.getTime() + offset * 86_400_000);
    const key = day.toISOString().slice(0, 10);
    return {
      date: key,
      count: events.filter((event) =>
        event.createdAt.toISOString().startsWith(key),
      ).length,
    };
  });
  const productivityTrend = activityByDay.map(({ date }) => ({
    date,
    completed: completedTasks.filter((task) =>
      task.updatedAt.toISOString().startsWith(date),
    ).length,
  }));
  const teamMap = new Map<
    string,
    { id: string; name: string; events: number; actors: Set<string> }
  >();
  for (const event of events) {
    const team = event.project?.team;
    if (!team) continue;
    const current = teamMap.get(team.id) ?? {
      ...team,
      events: 0,
      actors: new Set<string>(),
    };
    current.events += 1;
    current.actors.add(event.actorId);
    teamMap.set(team.id, current);
  }
  return {
    generatedAt: now.toISOString(),
    projects,
    members,
    activeUsers30d: actors.length,
    completedTasks30d: completedInRange,
    tasksByStatus,
    activityByDay,
    productivityTrend,
    teamActivity: [...teamMap.values()]
      .map((team) => ({
        id: team.id,
        name: team.name,
        events: team.events,
        activePeople: team.actors.size,
      }))
      .sort((a, b) => b.events - a.events),
    range: {
      from: from.toISOString().slice(0, 10),
      to: requestedTo.toISOString().slice(0, 10),
    },
  };
}

export async function getAnalytics(
  userId: string,
  organizationId: string,
  query: Omit<AnalyticsQuery, "organizationId"> = {},
) {
  await requirePermission(userId, organizationId, "organization:read");
  const filtered = Boolean(
    query.projectId || query.teamId || query.from || query.to,
  );
  if (filtered)
    return {
      analytics: await queryAnalytics(organizationId, query),
      cache: "unavailable" as const,
    };
  const key = analyticsKey(organizationId);
  const cached = await getCachedJson<AnalyticsSnapshot>(key);
  if (cached.state === "hit")
    return { analytics: cached.value, cache: "hit" as const };
  const analytics = await queryAnalytics(organizationId, query);
  const stored = await setCachedJson(key, analytics, ANALYTICS_TTL_SECONDS);
  return {
    analytics,
    cache: stored ? ("miss" as const) : ("unavailable" as const),
  };
}

export function invalidateAnalytics(organizationId: string) {
  return invalidateCache(analyticsKey(organizationId));
}
