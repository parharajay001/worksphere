# Day 11 verification — tasks

Tasks are owned by a project and inherit its organization boundary. The task
service verifies project membership before every read or mutation, validates
assignees against the same organization, and records reporter/assignee IDs
without trusting client tenancy fields.

`GET /api/tasks` supports project, status, priority, and assignee filters.
`POST /api/tasks` creates tasks; `GET/PATCH/DELETE /api/tasks/:id` handles task
details and changes. The protected `/tasks/:id` screen provides a focused task
detail view. Status ordering and drag/drop arrive in Day 12.
