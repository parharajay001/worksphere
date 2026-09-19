import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuditLog } from "@/components/audit-log";
import { getSessionUser } from "@/modules/auth/session";
import { hasPermission } from "@/modules/authorization/permissions";
import { listAuditEvents } from "@/modules/audit/audit.service";
import { auditQuerySchema } from "@/modules/audit/audit.schemas";
import { getActiveOrganization } from "@/modules/organizations/active-organization";
import {
  getOrganizationMembers,
  requireMembership,
} from "@/modules/organizations/organization.service";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const organization = await getActiveOrganization(user.id);
  if (!organization) redirect("/settings/workspace?create=1");
  const membership = await requireMembership(user.id, organization.id);
  if (!hasPermission(membership.role, "members:manage")) notFound();
  const raw = await searchParams;
  const parsed = auditQuerySchema.safeParse({
    organizationId: organization.id,
    limit: "50",
    ...(typeof raw.action === "string" && raw.action
      ? { action: raw.action }
      : {}),
    ...(typeof raw.actorId === "string" && raw.actorId
      ? { actorId: raw.actorId }
      : {}),
    ...(typeof raw.from === "string" && raw.from ? { from: raw.from } : {}),
    ...(typeof raw.to === "string" && raw.to ? { to: raw.to } : {}),
  });
  const query = parsed.success
    ? parsed.data
    : { organizationId: organization.id, limit: 50 };
  const [initialPage, members] = await Promise.all([
    listAuditEvents(user.id, query),
    getOrganizationMembers(user.id, organization.id),
  ]);
  const filters = {
    action: query.action,
    actorId: query.actorId,
    from: query.from,
    to: query.to,
  };
  return (
    <div className="overview protected-overview audit-page">
      <div className="page-breadcrumbs">
        <Link href="/dashboard">WorkSphere</Link>
        <span>/</span>Settings<span>/</span>Audit log
      </div>
      <header className="settings-page-header">
        <p className="eyebrow accent">Governance</p>
        <h1>Every important change, accounted for.</h1>
        <p>
          Review a tenant-scoped, append-only history of membership, workspace,
          and billing actions.
        </p>
      </header>
      <AuditLog
        organizationId={organization.id}
        initialPage={initialPage}
        members={members.map(({ user: member }) => member)}
        filters={filters}
      />
    </div>
  );
}
