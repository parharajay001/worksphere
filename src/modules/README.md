# Domain modules

Add business features here as their scheduled days begin (for example, `auth/`
and `organizations/`). Keep domain logic out of route and UI components.

The initial models live in `prisma/schema.prisma`. Follow the
[database and repository/service conventions](../../docs/database.md) when
introducing feature modules. Services own authorization and transactions;
repositories own scoped queries and safe projections. API validation and error
conventions are documented below. Extract shared packages only when a
second project proves the interface.

The `health/` module demonstrates the route → service → repository flow.
Use the [API foundation](../../docs/api.md) for input validation, JSON results,
typed errors, and request logging. Routes pass validated input to services;
repositories stay independent of HTTP.
