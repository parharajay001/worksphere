import Link from "next/link";
import { redirect } from "next/navigation";
import { ActivityFeed } from "@/components/activity-feed";
import { listActivity } from "@/modules/activity/activity.service";
import { getSessionUser } from "@/modules/auth/session";
import { getActiveOrganization } from "@/modules/organizations/active-organization";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const organization = await getActiveOrganization(user.id);
  if (!organization) redirect("/settings/workspace?create=1");
  const activity = await listActivity(
    user.id,
    { organizationId: organization.id },
    { limit: 25 },
  );

  return (
    <div className="overview protected-overview directory-page activity-page">
      <div className="page-breadcrumbs">
        <Link href="/dashboard">WorkSphere</Link>
        <span>/</span> Activity
      </div>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow accent">WORKSPACE TIMELINE</p>
          <h1>Activity</h1>
          <p className="intro">
            A chronological record of the decisions and updates shaping the
            work.
          </p>
        </div>
      </header>
      <ActivityFeed
        endpoint={`/api/organizations/${organization.id}/activity`}
        initialPage={activity}
        title={`${organization.name} timeline`}
      />
    </div>
  );
}
