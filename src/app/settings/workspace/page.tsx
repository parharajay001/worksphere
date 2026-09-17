import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspaceSettings } from "@/components/workspace-settings";
import { getSessionUser } from "@/modules/auth/session";
import { getActiveOrganization } from "@/modules/organizations/active-organization";
import { getOrganizations } from "@/modules/organizations/organization.service";

export const metadata = { title: "Workspace settings" };
export const dynamic = "force-dynamic";

export default async function WorkspaceSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const [memberships, active, query] = await Promise.all([
    getOrganizations(user.id),
    getActiveOrganization(user.id),
    searchParams,
  ]);

  return (
    <div className="overview protected-overview workspace-settings-page">
      <div className="page-breadcrumbs">
        <Link href="/dashboard">WorkSphere</Link>
        <span>/</span>Settings<span>/</span>Workspace
      </div>
      <header className="settings-page-header">
        <p className="eyebrow accent">Workspace administration</p>
        <h1>Shape the space around your work.</h1>
        <p>
          Manage the identity and lifecycle of each workspace you belong to.
        </p>
      </header>
      <WorkspaceSettings
        memberships={memberships}
        activeId={active?.id}
        startCreating={query.create === "1"}
      />
    </div>
  );
}
