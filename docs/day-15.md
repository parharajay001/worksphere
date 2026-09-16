# Day 15 verification - notifications

WorkSphere now persists in-app notifications for comment mentions. A mention
and its notification are created in the same database transaction, so the
inbox cannot show a notification for a comment that failed to save.

## Notification center

The dashboard displays the signed-in user's notifications with unread counts,
unread styling, mark-one-read, mark-all-read, and cursor-based loading for
older records. Notification reads are scoped by recipient ID; a user cannot
read or enumerate another user's notifications.

## API

- `GET /api/notifications?limit=20&cursor=<notification-id>&unreadOnly=true`
  lists the current user's notifications.
- `POST /api/notifications/:id/read` marks one notification read.
- `POST /api/notifications/read-all` marks all current-user notifications read.

Notification metadata is allowlisted and contains only IDs needed to connect a
mention to its task and comment. Actor, project, and task names are resolved
through relations and are nullable so notification history survives deletion
of the source record. Email, queue, and real-time delivery remain provider
seams for the later worker and WebSocket milestones.

`notifications/mapping.ts` owns the event-to-kind mapping, while
`notifications/preferences.ts` provides the default preference contract. The
current default keeps mention notifications in-app and leaves email disabled
until an email provider and background worker are available.

## Verification

```sh
npm run lint
npm run format:check
npm run typecheck
npm run test:db
npm run build
```

The database suite covers transactional mention notifications, unread/read
transitions, cursor ordering, and tenant boundaries.
