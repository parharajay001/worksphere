# Day 19 verification - realtime project and team chat

WorkSphere now persists scoped chat conversations and delivers message
invalidation, typing, and presence events through the authenticated Socket.IO
gateway introduced on Day 18.

## Data and API design

- A conversation belongs to exactly one project or team; PostgreSQL enforces
  that invariant and permits only one conversation per scope.
- Messages use bounded text, stable author relations, keyset history pagination,
  and indexes on `(conversationId, createdAt, id)`.
- Per-user read state is stored with a composite conversation/user key and is
  updated when messages are sent or viewed.
- Project conversations follow existing project access. Team conversations
  require team membership, while owners/admins/managers retain management
  access. Cross-tenant requests return the same not-found boundary used by the
  rest of WorkSphere.
- `POST /api/chat/conversations` creates or returns a project/team channel.
  Message history, send, and read endpoints live below
  `/api/chat/conversations/:id`.

## Realtime behavior

Persisted messages publish only conversation/message identifiers through Redis;
clients refetch authorized REST data. Typing events are accepted only from a
socket that already joined the authorized project/team room. Presence is
derived from authenticated socket user IDs, deduplicated across browser tabs,
and shared only inside that room.

The project chat UI reconnects and rejoins through the existing client, merges
new messages without discarding loaded history, reports online presence and
typing, and exposes paginated older messages.

## Attachment boundary

`ChatAttachment` stores provider-neutral metadata. `ChatAttachmentStore`
defines the future signed-upload boundary. Message APIs deliberately do not
accept client-authored storage keys; the disabled attachment control documents
where a validated object-storage flow will connect later.

## Run and verify

```sh
npm run infra:up
npm run db:deploy
npm run dev
npm run realtime

npm test
npm run test:db
npm run typecheck
npm run lint
npm run build
```
