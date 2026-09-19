import Link from "next/link";
import { redirect } from "next/navigation";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { getAnalytics } from "@/modules/analytics/analytics.service";
import { analyticsQuerySchema } from "@/modules/analytics/analytics.schemas";
import { getSessionUser } from "@/modules/auth/session";
import { getActiveOrganization } from "@/modules/organizations/active-organization";
import { listProjects } from "@/modules/projects/project.service";
import { listTeams } from "@/modules/teams/team.service";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const organization = await getActiveOrganization(user.id);
  if (!organization) redirect("/settings/workspace?create=1");
  const query = await searchParams;
  const parsed = analyticsQuerySchema.safeParse({
    organizationId: organization.id,
    ...(typeof query.projectId === "string" && query.projectId
      ? { projectId: query.projectId }
      : {}),
    ...(typeof query.teamId === "string" && query.teamId
      ? { teamId: query.teamId }
      : {}),
    ...(typeof query.from === "string" && query.from
      ? { from: query.from }
      : {}),
    ...(typeof query.to === "string" && query.to ? { to: query.to } : {}),
  });
  const filters = parsed.success
    ? {
        projectId: parsed.data.projectId,
        teamId: parsed.data.teamId,
        from: parsed.data.from,
        to: parsed.data.to,
      }
    : {};
  const [projects, teams, analyticsResult] = await Promise.all([
    listProjects(user.id, organization.id),
    listTeams(user.id, organization.id),
    getAnalytics(user.id, organization.id, filters),
  ]);

  return (
    <div className="overview protected-overview directory-page analytics-page">
      <div className="page-breadcrumbs">
        <Link href="/dashboard">WorkSphere</Link>
        <span>/</span> Reports
      </div>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow accent">DECISIONS, NOT NOISE</p>
          <h1>Reports</h1>
          <p className="intro">
            Read the pace of work, spot friction, and share the evidence.
          </p>
        </div>
      </header>
      <AnalyticsDashboard
        organizationId={organization.id}
        analytics={analyticsResult.analytics}
        projects={projects.map(({ id, name }) => ({ id, name }))}
        teams={teams.map(({ id, name }) => ({ id, name }))}
        filters={filters}
        filterAction="/analytics"
      />
    </div>
  );
}
