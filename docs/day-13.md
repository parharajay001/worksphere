# Day 13 verification - task comments

Task detail pages now include a project-member discussion thread. Members can
post comments, edit or delete their own comments, and load older comments. An
owner, admin, or manager can moderate any comment in the organization. Viewers
can read comments but cannot create, edit, or delete them.

Comments store the task, author, body, creation time, and update time. Bodies are
trimmed and limited to 5,000 characters at the request boundary and protected by
a database non-empty check. Author names and timestamps are displayed with an
edited marker when a comment changes. Comment text is rendered as text with
preserved line breaks; it is never interpreted as HTML.

## API

- `GET /api/tasks/:id/comments?limit=20&cursor=<comment-id>` lists comments newest-first.
- `POST /api/tasks/:id/comments` creates a comment with `{ "body": "..." }`.
- `PATCH /api/comments/:id` edits a comment with `{ "body": "..." }`.
- `DELETE /api/comments/:id` removes a comment and returns 204.

The list response is `{ data: { comments, nextCursor }, meta }`. `limit` accepts
1 through 50 and defaults to 20. `nextCursor` is the last comment ID when more
records exist, otherwise `null`. The cursor uses `(createdAt, id)` ordering so
comments created in the same timestamp remain deterministic. A cursor from a
different task is rejected without exposing that task.

All routes use the standard request ID, no-store response, validation, and safe
error envelope conventions. Anonymous users receive 401. A user outside the
task's organization receives 404. Members can read and create comments; editing
and deleting require comment authorship or `projects:manage`, with unauthorized
members receiving 403.

## Authorization and activity

Every operation resolves the task or comment through its task and project before
checking organization membership. The client never supplies an organization ID.
Creation, editing, and deletion write `comment.created`, `comment.updated`, or
`comment.deleted` activity events in the same transaction as the comment change.
If the event fails, the comment change rolls back. Event metadata includes task
and comment IDs; comment bodies are not copied into activity metadata.

## Verification

```sh
npm run check
npm run test:db
npm run test:e2e
```

The checks cover strict schemas, pagination, same-task cursor validation,
cross-tenant isolation, author-only mutations, manager moderation, database body
constraints, activity events, and rollback boundaries. The browser flow creates
21 comments, loads the second page, posts a new comment, edits it, deletes it,
and captures the task detail view.

## Limits

Comment pages are capped at 50 records and use an indexed task/time/ID access
path. The task detail page loads the first 20 comments server-side, then fetches
older pages on demand. Mentions, notifications, threaded replies, and real-time
updates are reserved for later milestones.
