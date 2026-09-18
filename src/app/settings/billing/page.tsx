import Link from "next/link";
import { redirect } from "next/navigation";
import { BillingManager } from "@/components/billing-manager";
import { getSessionUser } from "@/modules/auth/session";
import { hasPermission } from "@/modules/authorization/permissions";
import { getBillingSnapshot } from "@/modules/billing/billing.service";
import { getActiveOrganization } from "@/modules/organizations/active-organization";
import { requireMembership } from "@/modules/organizations/organization.service";

export const metadata = { title: "Billing settings" };
export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const organization = await getActiveOrganization(user.id);
  if (!organization) redirect("/settings/workspace?create=1");
  const [membership, snapshot, query] = await Promise.all([
    requireMembership(user.id, organization.id),
    getBillingSnapshot(user.id, organization.id),
    searchParams,
  ]);
  return (
    <div className="overview protected-overview billing-page">
      <div className="page-breadcrumbs">
        <Link href="/dashboard">WorkSphere</Link>
        <span>/</span>Settings<span>/</span>Billing
      </div>
      <header className="settings-page-header">
        <p className="eyebrow accent">Billing and capacity</p>
        <h1>Know exactly where your workspace stands.</h1>
        <p>
          Review usage, compare plans, and manage the subscription without
          leaving the workspace.
        </p>
      </header>
      <BillingManager
        organizationId={organization.id}
        organizationName={organization.name}
        snapshot={{
          ...snapshot,
          subscription: snapshot.subscription
            ? {
                status: snapshot.subscription.status,
                cancelAtPeriodEnd: snapshot.subscription.cancelAtPeriodEnd,
                currentPeriodEnd:
                  snapshot.subscription.currentPeriodEnd?.toISOString() ?? null,
              }
            : null,
        }}
        canManage={hasPermission(membership.role, "organization:update")}
        updated={query.billing === "updated"}
      />
    </div>
  );
}
