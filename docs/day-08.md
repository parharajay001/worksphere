# Day 8 verification — role-based access control

WorkSphere now has a centralized permission matrix for Owner, Admin, Manager,
Member, and Viewer roles. Services call `requirePermission(userId,
organizationId, permission)` after membership lookup; routes do not trust a
client-provided organization ID as authorization.

Organization updates require `organization:update`, deletion requires
`organization:delete`, member reads require `members:read`, and project work is
reserved for `projects:manage`. The dashboard exposes management affordances
only when the active membership grants the permission.

The role matrix is unit-tested for least privilege and reused by future teams,
projects, tasks, and billing mutations.
