import type { AnalyticsSnapshot } from "@/modules/analytics/analytics.service";

export function AnalyticsDashboard({
  organizationId,
  analytics,
}: {
  organizationId: string;
  analytics: AnalyticsSnapshot;
}) {
  return (
    <section className="analytics-dashboard" aria-labelledby="analytics-title">
      <div className="section-heading">
        <h2 id="analytics-title">Workspace pulse</h2>
        <a href={`/api/analytics/export?organizationId=${organizationId}`}>
          Export CSV
        </a>
      </div>
      <div className="analytics-grid">
        <article>
          <strong>{analytics.projects}</strong>
          <span>Projects</span>
        </article>
        <article>
          <strong>{analytics.members}</strong>
          <span>Members</span>
        </article>
        <article>
          <strong>{analytics.activeUsers30d}</strong>
          <span>Active users · 30d</span>
        </article>
        <article>
          <strong>{analytics.completedTasks30d}</strong>
          <span>Completed · 30d</span>
        </article>
      </div>
      <div className="analytics-statuses">
        {Object.entries(analytics.tasksByStatus).map(([status, count]) => (
          <span key={status}>
            {status.replace("_", " ")}: <strong>{count}</strong>
          </span>
        ))}
      </div>
    </section>
  );
}
