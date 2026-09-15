# Day 10 verification — projects

Projects are explicitly owned by an organization and optionally a team. Every
list, detail, mutation, and member operation first checks organization
membership and the `projects:manage` permission. Team IDs and project member IDs
are validated against the same organization before writes.

The project service records `project.created` and `project.updated` activity
events with the actor and structured metadata. The dashboard lists projects in
the active organization, and `/projects/:id` is a protected detail screen.

Routes: `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id`, and
`POST /api/projects/:id/members`.
