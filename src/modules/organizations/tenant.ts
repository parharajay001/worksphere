import "server-only";
import { requireMembership } from "./organization.service.ts";

/** Every tenant-scoped operation starts here; callers never authorize by ID alone. */
export async function requireTenant(userId: string, organizationId: string) {
  return requireMembership(userId, organizationId);
}
