# Domain modules

Add business features here as their scheduled days begin (for example, `auth/`
and `organizations/`). Keep domain logic out of route and UI components.

The initial models live in `prisma/schema.prisma`. Follow the
[database and repository/service conventions](../../docs/database.md) when
introducing feature modules. Services own authorization and transactions;
repositories own scoped queries and safe projections. General API validation
and error conventions start on Day 3. Extract shared packages only when a
second project proves the interface.
