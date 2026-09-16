# Day 12 verification - Kanban

The project detail page at `/projects/:id` now includes a four-column task
board: To do, In progress, Review, and Done. Cards show priority, assignee, due
date, and a link to task details. Managers, admins, and owners can create tasks,
drag them within or between columns, select a status, and move cards up/down.
Members and viewers can read the board without mutation controls.

The board uses dnd-kit's pointer and keyboard sensors. Dedicated drag handles
support touch without preventing scrolling elsewhere. Status selects and arrow
buttons provide non-drag alternatives. Layout changes from four columns to two
and then one on narrow screens. Saving, error, empty, and read-only states are
explicit; screen readers receive move announcements.

## Persistence and concurrency

Migration `20260916090000_kanban_ordering` adds `Task.position` and
`Project.boardRevision`. Existing tasks receive deterministic zero-based
positions per project/status, ordered by creation time and ID. Both new fields
have nonnegative database checks; `(projectId, status, position)` is indexed.

Every task mutation first updates its project row inside a transaction. This
row lock serializes writes for that project. A board move additionally requires
the exact revision returned by the board read. PostgreSQL rechecks this condition
after waiting for a concurrent writer, so two requests using one revision cannot
both succeed. A stale request receives the standard `409 CONFLICT` envelope.

The service reads the project's tasks after acquiring the lock, validates the
destination index, normalizes integer positions, and updates only changed rows.
The `task.moved` activity event and new revision commit with the position changes.
Any failure rolls everything back. Board reads use a repeatable-read transaction
so their revision and tasks describe one consistent snapshot.

Existing task create/update/delete endpoints also advance the revision. New
tasks append to their status column, and ordinary status updates append to the
destination column. Create now persists the accepted `status` field. Task
creation and update activity events also share their task transaction. Deletion
may leave gaps in integer positions; the next board move normalizes them.

## API

- `GET /api/projects/:id/board` returns `{ data: { board: { revision, tasks } }, meta }`.
- `PATCH /api/projects/:id/board` moves a task and returns the updated board.

Example PATCH body:

```json
{
  "taskId": "00000000-0000-4000-8000-000000000001",
  "status": "IN_PROGRESS",
  "index": 0,
  "revision": 3
}
```

`index` is zero-based in the destination column after removing the moving task.
Unknown fields, invalid IDs/statuses, and negative/fractional numbers are rejected.
Indices beyond the destination length return 400. A task outside the requested
project returns 404. Reads require organization membership; moves require the
existing `projects:manage` permission. Project visibility retains Day 10's
organization-wide policy. The board does not introduce private-project access.

Routes reuse request IDs, safe error envelopes, no-store responses, and structured
completion logs. Activity metadata records task ID, old/new status, and position.

## Optimistic updates

The UI moves the card immediately and permits only one outstanding mutation.
On failure it restores the previous state and fetches an authoritative snapshot.
This also handles a response lost after the server committed the move. If refresh
fails, mutations stay disabled until a manual refresh succeeds. A conflict is
shown to the user and is never automatically replayed over another user's work.

## Verification

```sh
npm run check
npm run test:db
npm run db:deploy
npm run test:e2e
```

Unit coverage verifies ordering and strict request validation. Disposable
PostgreSQL tests cover persisted moves, a two-request race, stale revisions,
tenant/project isolation, read-only roles, ordinary task CRUD invalidation, and
rollback when an activity insert fails. Browser coverage exercises pointer and
keyboard dragging, persistence after reload, optimistic movement and rollback,
stale conflicts, creation, detail navigation, read-only controls, and responsive
desktop/mobile screenshots under `test-results/`.

Verified locally: lint, formatting, Prisma validation, typecheck, production
build, 27 unit tests, 14 database integration tests, and all 6 browser tests
passed. The Kanban
browser workflow passed at 1440px desktop and 390px mobile widths, including
401/403/404 access checks and invalid move validation.

The full browser suite may take an extra minute: its sixth account registration
honors the authentication endpoint's `Retry-After` response.

## Operation and limits

Apply the additive migration before starting the new app version. The local
Compose database is sufficient; no new environment variables or services are
needed. Use `npm run dev` and open a project from the dashboard. Deployment to
cloud infrastructure remains scheduled for later milestones.

This implementation loads a complete project board and may update O(n) positions
per move. It is designed for the current small project boards. Large boards need
measured limits, virtualization, and potentially sparse ranks. A project-level
revision deliberately rejects concurrent changes even in different columns.
Live collaboration arrives on Day 18; users can refresh to see other sessions.
Day 13 adds task comments.
