import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";
import { getSessionUser } from "@/modules/auth/session";
import { hasPermission } from "@/modules/authorization/permissions";
import { getActiveOrganization } from "@/modules/organizations/active-organization";
import { requireMembership } from "@/modules/organizations/organization.service";
import { listProjects } from "@/modules/projects/project.service";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const organization = await getActiveOrganization(user.id);
  if (!organization) redirect("/settings/workspace?create=1");
  const [projects, membership] = await Promise.all([
    listProjects(user.id, organization.id),
    requireMembership(user.id, organization.id),
  ]);
  const canManage = hasPermission(membership.role, "projects:manage");
  const activeCount = projects.filter(
    (project) => project.status === "ACTIVE",
  ).length;

  return (
    <div className="overview protected-overview directory-page projects-page">
      <div className="page-breadcrumbs">
        <Link href="/dashboard">WorkSphere</Link>
        <span>/</span> Projects
      </div>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow accent">WORK DIRECTORY</p>
          <h1>Projects</h1>
          <p className="intro">
            Every initiative in one place, from first brief to final handoff.
          </p>
        </div>
        {canManage && (
          <Link className="primary-link" href="/projects/new">
            <Plus size={15} aria-hidden="true" /> Create project
          </Link>
        )}
      </header>
      <section
        className="project-list"
        aria-labelledby="project-directory-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{organization.name}</p>
            <h2 id="project-directory-title">All projects</h2>
          </div>
          <span className="outline-label">{activeCount} active</span>
        </div>
        {projects.length ? (
          <div className="project-grid">
            {projects.map((project, index) => (
              <Link
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
                <span className="project-card-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty-state">
            <span aria-hidden="true">
              <FolderKanban size={28} />
            </span>
            <div>
              <h3>Your first project starts here.</h3>
              <p>Turn an idea into a shared plan for your team.</p>
            </div>
            {canManage && (
              <Link className="primary-link" href="/projects/new">
                Create project
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
