"use client";

import { useState } from "react";
import {
  Download,
  LoaderCircle,
  SlidersHorizontal,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import type { AnalyticsSnapshot } from "@/modules/analytics/analytics.service";

type Option = { id: string; name: string };
type Filters = {
  projectId?: string;
  teamId?: string;
  from?: string;
  to?: string;
};
const statusLabels: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  REVIEW: "Review",
  DONE: "Done",
};

export function AnalyticsDashboard({
  organizationId,
  analytics,
  projects,
  teams,
  filters,
  filterAction = "/dashboard",
}: {
  organizationId: string;
  analytics: AnalyticsSnapshot;
  projects: Option[];
  teams: Option[];
  filters: Filters;
  filterAction?: string;
}) {
  const [exportState, setExportState] = useState<
    "" | "loading" | "done" | "error"
  >("");
  const statusEntries = Object.entries(analytics.tasksByStatus);
  const statusTotal = statusEntries.reduce((sum, [, count]) => sum + count, 0);
  const trendMax = Math.max(
    1,
    ...analytics.productivityTrend.map((item) => item.completed),
  );
  const teamMax = Math.max(
    1,
    ...analytics.teamActivity.map((item) => item.events),
  );
  const query = new URLSearchParams({ organizationId });
  for (const [key, value] of Object.entries(filters))
    if (value) query.set(key, value);

  async function exportCsv() {
    setExportState("loading");
    try {
      const response = await fetch(`/api/analytics/export?${query}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `worksphere-analytics-${analytics.range.from}-${analytics.range.to}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportState("done");
    } catch {
      setExportState("error");
    }
  }

  return (
    <section className="analytics-dashboard" aria-labelledby="analytics-title">
      <div className="section-heading analytics-heading">
        <div>
          <p className="eyebrow accent">Workspace intelligence</p>
          <h2 id="analytics-title">Workspace pulse</h2>
        </div>
        <button
          className="analytics-export"
          type="button"
          onClick={() => void exportCsv()}
          disabled={exportState === "loading"}
        >
          {exportState === "loading" ? (
            <LoaderCircle className="spin" size={14} />
          ) : (
            <Download size={14} />
          )}
          {exportState === "loading" ? "Preparing…" : "Export CSV"}
        </button>
      </div>
      <p className="analytics-export-status" aria-live="polite">
        {exportState === "done"
          ? "Export downloaded."
          : exportState === "error"
            ? "Export failed. Try again."
            : ""}
      </p>
      <form className="analytics-filters" action={filterAction} method="get">
        <SlidersHorizontal size={16} aria-hidden="true" />
        <label>
          <span>From</span>
          <input
            type="date"
            name="from"
            defaultValue={filters.from ?? analytics.range.from}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            name="to"
            defaultValue={filters.to ?? analytics.range.to}
          />
        </label>
        <label>
          <span>Project</span>
          <select name="projectId" defaultValue={filters.projectId ?? ""}>
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Team</span>
          <select name="teamId" defaultValue={filters.teamId ?? ""}>
            <option value="">All teams</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Apply filters</button>
        {Object.values(filters).some(Boolean) && (
          <a href={filterAction}>Reset</a>
        )}
      </form>
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
          <span>Active users · range</span>
        </article>
        <article>
          <strong>{analytics.completedTasks30d}</strong>
          <span>Completed · range</span>
        </article>
      </div>
      <div className="analytics-visual-grid">
        <article className="analytics-chart-card">
          <header>
            <div>
              <p className="eyebrow">WORK DISTRIBUTION</p>
              <h3>Tasks by status</h3>
            </div>
            <strong>{statusTotal}</strong>
          </header>
          {statusTotal ? (
            <div className="status-chart">
              {statusEntries.map(([status, count]) => (
                <div key={status}>
                  <div>
                    <span>{statusLabels[status] ?? status}</span>
                    <strong>{count}</strong>
                  </div>
                  <div className={`status-bar status-${status.toLowerCase()}`}>
                    <span
                      style={{ width: `${(count / statusTotal) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="analytics-empty">No tasks match these filters.</p>
          )}
        </article>
        <article className="analytics-chart-card">
          <header>
            <div>
              <p className="eyebrow">THROUGHPUT</p>
              <h3>Productivity trend</h3>
            </div>
            <TrendingUp size={20} />
          </header>
          {analytics.productivityTrend.some((item) => item.completed) ? (
            <div className="trend-chart" aria-label="Completed tasks by day">
              {analytics.productivityTrend.map((item) => (
                <div
                  key={item.date}
                  title={`${item.date}: ${item.completed} completed`}
                >
                  <span
                    style={{
                      height: `${Math.max(5, (item.completed / trendMax) * 100)}%`,
                    }}
                  />
                  <small>
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(`${item.date}T00:00:00Z`))}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <p className="analytics-empty">
              No completed tasks in this date range.
            </p>
          )}
        </article>
        <article className="analytics-chart-card team-activity-card">
          <header>
            <div>
              <p className="eyebrow">COLLABORATION</p>
              <h3>Team activity</h3>
            </div>
            <UsersRound size={20} />
          </header>
          {analytics.teamActivity.length ? (
            <div className="team-activity-list">
              {analytics.teamActivity.map((team) => (
                <div key={team.id}>
                  <div>
                    <strong>{team.name}</strong>
                    <span>
                      {team.events} events · {team.activePeople} active
                    </span>
                  </div>
                  <div>
                    <span
                      style={{ width: `${(team.events / teamMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="analytics-empty">
              No team activity matches these filters.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
