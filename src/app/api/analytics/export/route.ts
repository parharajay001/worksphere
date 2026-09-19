import { createApiHandler } from "@/lib/api/handler";
import { parseQuery } from "@/lib/api/validation";
import { raw } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { analyticsQuerySchema } from "@/modules/analytics/analytics.schemas";
import { getAnalytics } from "@/modules/analytics/analytics.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createApiHandler(
  { route: "/api/analytics/export" },
  async (request) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { organizationId, ...query } = await parseQuery(
      request,
      analyticsQuerySchema,
    );
    const { analytics } = await getAnalytics(user.id, organizationId, query);
    const rows: (string | number)[][] = [
      ["metric", "value"],
      ["projects", analytics.projects],
      ["members", analytics.members],
      ["active_users_30d", analytics.activeUsers30d],
      ["completed_tasks_30d", analytics.completedTasks30d],
      ...Object.entries(analytics.tasksByStatus).map(([status, count]) => [
        `tasks_${status.toLowerCase()}`,
        count,
      ]),
      ...analytics.productivityTrend.map((item) => [
        `completed_${item.date}`,
        item.completed,
      ]),
      ...analytics.teamActivity.map((item) => [
        `team_activity_${item.name}`,
        item.events,
      ]),
    ];
    const csv =
      rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
    return raw(csv, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="worksphere-analytics-${organizationId}.csv"`,
    });
  },
);

function csvCell(value: string | number) {
  const source = String(value);
  const safe = /^[=+\-@]/.test(source) ? `'${source}` : source;
  return `"${safe.replaceAll('"', '""')}"`;
}
