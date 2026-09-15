# Day 6 verification — organizations

Organizations are the tenant boundary for WorkSphere. Authenticated users can
list their memberships and create a workspace. Creation uses one transaction
to create the organization and its `OWNER` membership, so an organization is
never left without an owner membership.

## API

- `GET/POST /api/organizations` list memberships or create a workspace.
- `GET/PATCH/DELETE /api/organizations/:id` read and mutate only memberships;
  updates require Owner/Admin and deletion requires Owner.
- `GET/PUT /api/organizations/active` reads or changes the active workspace.
  The active ID is stored in an HttpOnly cookie and is always rechecked against
  the current user membership.

The seed now creates `worksphere-demo` and `worksphere-labs`; only the demo
owner belongs to both, which provides a simple cross-tenant isolation fixture.
Organization IDs supplied by clients are never trusted without a membership
query.
