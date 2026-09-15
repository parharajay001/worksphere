import "server-only";
import { AppError } from "../../lib/api/errors.ts";
import { findMembership } from "../organizations/organization.repository.ts";
import { hasPermission, type Permission } from "./permissions.ts";

export async function requirePermission(
  userId: string,
  organizationId: string,
  permission: Permission,
) {
  const membership = await findMembership(userId, organizationId);
  if (!membership) throw new AppError("NOT_FOUND");
  if (!hasPermission(membership.role, permission))
    throw new AppError("FORBIDDEN");
  return membership;
}
