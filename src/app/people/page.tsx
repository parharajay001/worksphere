import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/modules/auth/session";
import { getActiveOrganization } from "@/modules/organizations/active-organization";
import {
  getOrganizationMembers,
  requireMembership,
} from "@/modules/organizations/organization.service";
import { listInvitations } from "@/modules/invitations/invitation.service";
import { hasPermission } from "@/modules/authorization/permissions";
import { PeopleManager } from "@/components/people-manager";
export const dynamic = "force-dynamic";
export default async function PeoplePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const organization = await getActiveOrganization(user.id);
  if (!organization) redirect("/settings/workspace?create=1");
  const membership = await requireMembership(user.id, organization.id);
  const canReadMembers = hasPermission(membership.role, "members:read");
  if (!canReadMembers)
    return (
      <div className="overview protected-overview directory-page">
        <div className="page-breadcrumbs">
          <Link href="/dashboard">WorkSphere</Link>
          <span>/</span> People
        </div>
        <header className="dashboard-header">
          <div>
            <p className="eyebrow accent">WORKSPACE ACCESS</p>
            <h1>People</h1>
            <p className="intro">
              Your viewer role does not include access to the workspace
              directory.
            </p>
          </div>
          <Link className="secondary-button" href="/teams">
            View teams
          </Link>
        </header>
        <div className="dashboard-empty-state">
          <span aria-hidden="true">RO</span>
          <div>
            <h3>Directory access is limited.</h3>
            <p>Ask a workspace owner or admin if you need member details.</p>
          </div>
        </div>
      </div>
    );
  const [members, invitations] = await Promise.all([
    getOrganizationMembers(user.id, organization.id),
    listInvitations(user.id, organization.id),
  ]);
  return (
    <div className="overview protected-overview directory-page">
      <div className="page-breadcrumbs">
        <Link href="/dashboard">WorkSphere</Link>
        <span>/</span> People
      </div>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow accent">WORKSPACE ACCESS</p>
          <h1>People</h1>
          <p className="intro">
            Invite collaborators, tune access, and keep the roster current.
          </p>
        </div>
        <Link className="secondary-button" href="/teams">
          View teams
        </Link>
      </header>
      <PeopleManager
        organizationId={organization.id}
        currentUserId={user.id}
        currentRole={membership.role}
        canManage={hasPermission(membership.role, "members:manage")}
        initialMembers={members}
        initialInvitations={invitations}
      />
    </div>
  );
}
