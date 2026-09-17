import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProjectForm } from "@/components/project-form";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { hasPermission } from "@/modules/authorization/permissions";
import { requirePermission } from "@/modules/authorization/guards";
import { getOrganizationMembers } from "@/modules/organizations/organization.service";
import { projectIdSchema } from "@/modules/projects/project.schemas";
import {
  getProject,
  listProjectMembers,
} from "@/modules/projects/project.service";
import { listTeams } from "@/modules/teams/team.service";

export const metadata = { title: "Project settings" };
export const dynamic = "force-dynamic";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const parsed = projectIdSchema.safeParse(await params);
  if (!parsed.success) notFound();
  let project;
  try {
    project = await getProject(user.id, parsed.data.id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const membership = await requirePermission(
    user.id,
    project.organizationId,
    "organization:read",
  );
  if (!hasPermission(membership.role, "projects:manage"))
    redirect(`/projects/${project.id}`);
  const [teams, members, projectMembers] = await Promise.all([
    listTeams(user.id, project.organizationId),
    getOrganizationMembers(user.id, project.organizationId),
    listProjectMembers(user.id, project.id),
  ]);

  return (
    <div className="overview protected-overview project-settings-page">
      <div className="page-breadcrumbs">
        <Link href="/dashboard">Projects</Link>
        <span>/</span>
        <Link href={`/projects/${project.id}`}>{project.name}</Link>
        <span>/</span>Settings
      </div>
      <ProjectForm
        organizationId={project.organizationId}
        organizationName={membership.organization.name}
        teams={teams}
        members={members}
        project={project}
        initialProjectMembers={projectMembers}
      />
    </div>
  );
}
