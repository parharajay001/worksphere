# Day 14 verification - mentions and activity

Comments now support organization-member mentions. Tokens such as `@name` and
`@email-local-part` are deduplicated, capped at 25 per comment, and resolved
against the current organization membership. Unknown or inaccessible members
are rejected before a comment is written.

The comment composer loads safe mention candidates from the task's organization
and offers filtered suggestions as soon as a user types `@`. Arrow keys, Enter,
Tab, Escape, and pointer selection are supported; the inserted token always
uses the member's email local part so it resolves consistently on the server.

## Activity feeds

Project and workspace pages show a newest-first activity feed. Feed pages use a
stable `(createdAt, id)` cursor, return at most 50 records, and expose only
allowlisted metadata such as task and comment IDs. Project feeds cannot be
used to read another project, and organization feeds require organization
membership.

## API

- `GET /api/projects/:id/activity?limit=25&cursor=<event-id>` lists project activity.
- `GET /api/organizations/:id/activity?limit=25&cursor=<event-id>` lists workspace activity.
- `POST /api/tasks/:id/comments` and `PATCH /api/comments/:id` resolve mentions,
  write `mention.created` events, and invoke the notification delivery seam.

Mention events are written in the same transaction as the comment mutation.
The delivery seam is intentionally a no-op until the notifications/worker
milestone; it receives recipient, actor, task, and comment IDs without putting
provider credentials in the request path.

## Verification

```sh
npm run lint
npm run format:check
npm run typecheck
npm run test:db
```

The database suite covers mention deduplication, inaccessible-member rejection,
transactional activity events, project and organization scopes, pagination,
and cross-tenant authorization. Browser verification should confirm the feed
renders on project and dashboard pages and that loading older activity keeps
the cursor order.
