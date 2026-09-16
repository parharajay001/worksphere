import { redirect } from "next/navigation";
import { getSessionUser } from "../../modules/auth/session.ts";
import { SignOutButton } from "../../components/sign-out-button";
import { getOrganizations } from "../../modules/organizations/organization.service.ts";
import { getActiveOrganization } from "../../modules/organizations/active-organization.ts";
import { OrganizationSwitcher } from "../../components/organization-switcher";
import { hasPermission } from "../../modules/authorization/permissions.ts";
import { listProjects } from "../../modules/projects/project.service.ts";
import { listActivity } from "../../modules/activity/activity.service.ts";
import { ActivityFeed } from "../../components/activity-feed";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const memberships = await getOrganizations(user.id);
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
  return (
    <div className="overview protected-overview">
      <p className="eyebrow accent">Private workspace</p>
      <h1>
        Welcome, <em>{user.name}</em>.
      </h1>
      <p className="intro">
        You’re signed in as {user.email}. Organization setup arrives on Day 6.
      </p>
      <SignOutButton />
      <OrganizationSwitcher
        organizations={memberships.map(({ organization }) => organization)}
        activeId={activeOrganization?.id}
      />
      {activeOrganization &&
      memberships.some(
        ({ organization, role }) =>
          organization.id === activeOrganization.id &&
          hasPermission(role, "organization:update"),
      ) ? (
        <p className="quiet-label">You can manage this organization.</p>
      ) : null}
      <section className="project-list" aria-labelledby="projects-title">
        <div className="section-heading">
          <h2 id="projects-title">Projects</h2>
          <span className="outline-label">
            {projects.length} active space{projects.length === 1 ? "" : "s"}
          </span>
        </div>
        {projects.length ? (
          <div className="project-grid">
            {projects.map((project) => (
              <a
                className="project-card"
                key={project.id}
                href={`/projects/${project.id}`}
              >
                <span className="eyebrow accent">{project.status}</span>
                <h3>{project.name}</h3>
                <p>
                  {project.description ??
                    "A focused space for shared progress."}
                </p>
              </a>
            ))}
          </div>
        ) : (
          <p className="empty-workspace">
            No projects yet. Create one through the projects API.
          </p>
        )}
      </section>
      {activeOrganization && (
        <ActivityFeed
          endpoint={`/api/organizations/${activeOrganization.id}/activity`}
          initialPage={activity}
          title="Workspace activity"
        />
      )}
    </div>
  );
}
