import assert from "node:assert/strict";
import { test } from "node:test";
import { cookieValue } from "../src/realtime/cookie.ts";
import {
  realtimeEventSchema,
  roomTargetSchema,
} from "../src/realtime/contracts.ts";

const userId = "10000000-0000-4000-8000-000000000001";
const organizationA = "20000000-0000-4000-8000-000000000001";
const organizationB = "20000000-0000-4000-8000-000000000002";
const projectA = "30000000-0000-4000-8000-000000000001";
const projectB = "30000000-0000-4000-8000-000000000002";
const teamA = "40000000-0000-4000-8000-000000000001";

test("parses an exact session cookie without accepting malformed encoding", () => {
  assert.equal(
    cookieValue(
      "theme=dark; worksphere_session=abc%20123; other=x",
      "worksphere_session",
    ),
    "abc 123",
  );
  assert.equal(
    cookieValue("worksphere_session=%E0%A4%A", "worksphere_session"),
    null,
  );
  assert.equal(
    cookieValue("not_the_session=value", "worksphere_session"),
    null,
  );
});

test("room contracts reject malformed IDs and injected fields", () => {
  assert.equal(
    roomTargetSchema.safeParse({ kind: "project", id: projectA }).success,
    true,
  );
  assert.equal(
    roomTargetSchema.safeParse({ kind: "project", id: "not-an-id" }).success,
    false,
  );
  assert.equal(
    roomTargetSchema.safeParse({
      kind: "organization",
      id: organizationA,
      userId,
    }).success,
    false,
  );
});

test("project and organization rooms enforce tenant membership", async () => {
  process.env.DATABASE_URL ??=
    "postgresql://worksphere:worksphere_local@localhost:54329/worksphere?schema=public";
  const { authorizeRealtimeRoom } = await import("../src/realtime/rooms.ts");
  const lookups = {
    organizationMember: async (candidateUser: string, organizationId: string) =>
      candidateUser === userId && organizationId === organizationA,
    projectOrganization: async (projectId: string) =>
      projectId === projectA
        ? organizationA
        : projectId === projectB
          ? organizationB
          : null,
    teamAccess: async (candidateUser: string, teamId: string) =>
      candidateUser === userId && teamId === teamA ? organizationA : null,
  };

  assert.equal(
    await authorizeRealtimeRoom(
      userId,
      { kind: "organization", id: organizationA },
      lookups,
    ),
    `organization:${organizationA}`,
  );
  assert.equal(
    await authorizeRealtimeRoom(
      userId,
      { kind: "project", id: projectA },
      lookups,
    ),
    `project:${projectA}`,
  );
  assert.equal(
    await authorizeRealtimeRoom(
      userId,
      { kind: "organization", id: organizationB },
      lookups,
    ),
    null,
  );
  assert.equal(
    await authorizeRealtimeRoom(
      userId,
      { kind: "project", id: projectB },
      lookups,
    ),
    null,
  );
  assert.equal(
    await authorizeRealtimeRoom(userId, { kind: "team", id: teamA }, lookups),
    `team:${teamA}`,
  );
});

test("pub/sub accepts only bounded realtime event envelopes", () => {
  assert.equal(
    realtimeEventSchema.safeParse({
      name: "task.changed",
      target: { projectId: projectA },
      payload: { projectId: projectA, taskId: userId, action: "moved" },
    }).success,
    true,
  );
  assert.equal(
    realtimeEventSchema.safeParse({
      name: "task.changed",
      target: { projectId: projectA },
      payload: {
        projectId: projectA,
        taskId: userId,
        action: "moved",
        secret: "must not cross the socket boundary",
      },
    }).success,
    false,
  );
});
