import { redirect } from "next/navigation";
import { getSessionUser } from "../../modules/auth/session.ts";
import { SignOutButton } from "../../components/sign-out-button";
import { getOrganizations } from "../../modules/organizations/organization.service.ts";
import { getActiveOrganization } from "../../modules/organizations/active-organization.ts";
import { OrganizationSwitcher } from "../../components/organization-switcher";
import { hasPermission } from "../../modules/authorization/permissions.ts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const memberships = await getOrganizations(user.id);
  const activeOrganization = await getActiveOrganization(user.id);
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
    </div>
  );
}
