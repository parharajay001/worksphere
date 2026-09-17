import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/modules/auth/session";
import { SignOutButton } from "@/components/sign-out-button";
import { getActiveOrganization } from "@/modules/organizations/active-organization";
import { listProjects } from "@/modules/projects/project.service";
import { listActivity } from "@/modules/activity/activity.service";
import { ActivityFeed } from "@/components/activity-feed";
import { NotificationCenter } from "@/components/notification-center";
import { listNotifications } from "@/modules/notifications/notification.service";
import { getAnalytics } from "@/modules/analytics/analytics.service";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const activeOrganization = await getActiveOrganization(user.id);
  const projects = activeOrganization
    ? await listProjects(user.id, activeOrganization.id)
    : [];
  const activity = activeOrganization
    ? await listActivity(
        user.id,
        { organizationId: activeOrganization.id },
        { limit: 20 },
      )
    : { activities: [], nextCursor: null };
  const notifications = await listNotifications(user.id, {
    limit: 20,
    unreadOnly: false,
  });
  const analytics = activeOrganization
    ? (await getAnalytics(user.id, activeOrganization.id)).analytics
    : null;

  return (
    <div className="overview protected-overview dashboard-page">
      <div className="page-breadcrumbs">
        WorkSphere <span>/</span> Your work
      </div>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow accent">TEAM OVERVIEW</p>
          <h1>Good morning, {user.name.split(" ")[0]}.</h1>
          <p className="intro">
            Here&apos;s what&apos;s moving across your workspace today.
          </p>
        </div>
        <div className="dashboard-header-actions">
          <SignOutButton />
        </div>
      </header>
      {activeOrganization && analytics && (
        <div id="analytics">
          <AnalyticsDashboard
            organizationId={activeOrganization.id}
            analytics={analytics}
          />
        </div>
      )}
      <section
        id="projects"
        className="project-list"
        aria-labelledby="projects-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">CURRENT WORK</p>
            <h2 id="projects-title">Projects</h2>
          </div>
          <span className="outline-label">{projects.length} active</span>
        </div>
        {projects.length ? (
          <div className="project-grid">
            {projects.map((project, index) => (
              <a
                className="project-card"
                key={project.id}
                href={`/projects/${project.id}`}
              >
                <span
                  className={`project-card-icon project-color-${index % 4}`}
                >
                  {project.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="project-card-copy">
                  <span className="eyebrow accent">{project.status}</span>
                  <h3>{project.name}</h3>
                  <p>
                    {project.description ??
                      "A focused space for shared progress."}
                  </p>
                </span>
                <span className="project-card-arrow">→</span>
              </a>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty-state">
            <span aria-hidden="true">{activeOrganization ? "01" : "WS"}</span>
            <div>
              <h3>
                {activeOrganization
                  ? "Your first project starts here."
                  : "Create your first workspace."}
              </h3>
              <p>
                {activeOrganization
                  ? "Turn an idea into a shared plan for your team."
                  : "A workspace keeps your people, projects, and progress together."}
              </p>
            </div>
            <Link
              className="primary-link"
              href={
                activeOrganization
                  ? "/settings/workspace"
                  : "/settings/workspace?create=1"
              }
            >
              {activeOrganization ? "Workspace Settings" : "Create Workspace"}
            </Link>
          </div>
        )}
      </section>
      <div className="dashboard-lower-grid">
        <div id="activity">
          {activeOrganization && (
            <ActivityFeed
              endpoint={`/api/organizations/${activeOrganization.id}/activity`}
              initialPage={activity}
              title="Recent activity"
            />
          )}
        </div>
        <NotificationCenter initialPage={notifications} />
      </div>
    </div>
  );
}
