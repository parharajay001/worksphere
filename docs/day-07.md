# Day 7 verification — tenant isolation

Tenant-scoped organization operations now begin with a membership check. The
shared `requireTenant` boundary and organization services prevent a caller from
using an organization ID as authorization. Member listing, organization reads,
updates, deletes, and active-workspace selection all enforce this rule.

The member endpoint (`GET /api/organizations/:id/members`) demonstrates the
pattern: it verifies the current user belongs to the requested organization,
then performs a query constrained by that organization ID. A user who belongs
to another organization receives the same not-found response as an unknown
organization, avoiding cross-tenant disclosure.

The disposable database suite runs migrations and repeatable seed data with two
organizations, providing the isolation fixture for future project/task tables.
