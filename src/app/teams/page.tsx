import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/modules/auth/session";
import { getActiveOrganization } from "@/modules/organizations/active-organization";
import {
  getOrganizationMembers,
  requireMembership,
} from "@/modules/organizations/organization.service";
import { hasPermission } from "@/modules/authorization/permissions";
import { listTeams } from "@/modules/teams/team.service";
import { TeamsManager } from "@/components/teams-manager";
export const dynamic = "force-dynamic";
export default async function TeamsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const organization = await getActiveOrganization(user.id);
  if (!organization) redirect("/settings/workspace?create=1");
  const membership = await requireMembership(user.id, organization.id);
  const [teams, members] = await Promise.all([
    listTeams(user.id, organization.id),
    getOrganizationMembers(user.id, organization.id),
  ]);
  return (
    <div className="overview protected-overview directory-page">
      <div className="page-breadcrumbs">
        <Link href="/dashboard">WorkSphere</Link>
        <span>/</span> Teams
      </div>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow accent">WORKSPACE DIRECTORY</p>
          <h1>Teams</h1>
          <p className="intro">
            Shape clear working groups without putting up walls.
          </p>
        </div>
        <Link className="secondary-button" href="/people">
          Manage people
        </Link>
      </header>
      <TeamsManager
        organizationId={organization.id}
        canManage={hasPermission(membership.role, "members:manage")}
        members={members}
        initialTeams={teams}
      />
    </div>
  );
}
