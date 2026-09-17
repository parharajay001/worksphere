import Link from "next/link";
import { redirect } from "next/navigation";
import { ProjectForm } from "@/components/project-form";
import { getSessionUser } from "@/modules/auth/session";
import { hasPermission } from "@/modules/authorization/permissions";
import { getActiveOrganization } from "@/modules/organizations/active-organization";
import {
  getOrganizationMembers,
  requireMembership,
} from "@/modules/organizations/organization.service";
import { listTeams } from "@/modules/teams/team.service";

export const metadata = { title: "Create project" };
export const dynamic = "force-dynamic";

export default async function CreateProjectPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const organization = await getActiveOrganization(user.id);
  if (!organization) redirect("/settings/workspace?create=1");
  const membership = await requireMembership(user.id, organization.id);
  if (!hasPermission(membership.role, "projects:manage"))
    redirect("/dashboard");
  const [teams, members] = await Promise.all([
    listTeams(user.id, organization.id),
    getOrganizationMembers(user.id, organization.id),
  ]);

  return (
    <div className="overview protected-overview project-settings-page">
      <div className="page-breadcrumbs">
        <Link href="/dashboard">Projects</Link>
        <span>/</span>New project
      </div>
      <ProjectForm
        organizationId={organization.id}
        organizationName={organization.name}
        teams={teams}
        members={members}
      />
    </div>
  );
}
