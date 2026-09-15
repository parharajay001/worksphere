import "server-only";
import type { MembershipRole } from "../../generated/prisma/client.ts";

export type Permission =
  | "organization:read"
  | "organization:update"
  | "organization:delete"
  | "members:read"
  | "members:manage"
  | "projects:manage";
const matrix: Record<MembershipRole, readonly Permission[]> = {
  OWNER: [
    "organization:read",
    "organization:update",
    "organization:delete",
    "members:read",
    "members:manage",
    "projects:manage",
  ],
  ADMIN: [
    "organization:read",
    "organization:update",
    "members:read",
    "members:manage",
    "projects:manage",
  ],
  MANAGER: ["organization:read", "members:read", "projects:manage"],
  MEMBER: ["organization:read", "members:read"],
  VIEWER: ["organization:read"],
};
export function hasPermission(role: MembershipRole, permission: Permission) {
  return matrix[role].includes(permission);
}
export function permissionsForRole(role: MembershipRole) {
  return matrix[role];
}
