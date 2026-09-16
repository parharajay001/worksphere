import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import type { Job } from "bullmq";
import { emailJobDefaults, enqueueEmailJob } from "../src/queue/email-queue.ts";
import type { EmailJobMap } from "../src/queue/contracts.ts";

test("email jobs have deterministic IDs and retry/dead-letter defaults", async () => {
  const calls: unknown[][] = [];
  const writer = {
    add: async (...args: unknown[]) => {
      calls.push(args);
      return {} as never;
    },
  };

  await enqueueEmailJob(
    "invitation.email",
    { invitationId: "invitation-1", token: "secret" },
    "invitation-email-invitation-1",
    writer as never,
  );

  assert.deepEqual(calls, [
    [
      "invitation.email",
      { invitationId: "invitation-1", token: "secret" },
      { jobId: "invitation-email-invitation-1" },
    ],
  ]);
  assert.deepEqual(emailJobDefaults, {
    attempts: 5,
    backoff: { type: "exponential", delay: 1_000 },
    removeOnComplete: { age: 86_400, count: 1_000 },
    removeOnFail: false,
  });
});

test("worker validates invitation state and passes the provider idempotency key", async () => {
  process.env.DATABASE_URL ??=
    "postgresql://worksphere:worksphere_local@localhost:54329/worksphere?schema=public";
  const { createEmailProcessor } =
    await import("../src/workers/email.processor.ts");
  const deliveries: unknown[] = [];
  const token = "raw-token";
  const processor = createEmailProcessor({
    findInvitation: async (query) => {
      assert.equal(
        query.where.tokenHash,
        createHash("sha256").update(token).digest("hex"),
      );
      return { email: "member@example.com", organization: { name: "Acme" } };
    },
    deliver: async (email) => void deliveries.push(email),
  });
  const job = {
    id: "invitation-email-invitation-1",
    name: "invitation.email",
    data: { invitationId: "invitation-1", token },
  } as Job<EmailJobMap[keyof EmailJobMap], void, keyof EmailJobMap>;

  await processor(job);
  assert.deepEqual(deliveries, [
    {
      to: "member@example.com",
      organizationName: "Acme",
      token,
      idempotencyKey: "invitation-email-invitation-1",
    },
  ]);
});

test("worker treats stale invitation jobs as successful no-ops", async () => {
  process.env.DATABASE_URL ??=
    "postgresql://worksphere:worksphere_local@localhost:54329/worksphere?schema=public";
  const { createEmailProcessor } =
    await import("../src/workers/email.processor.ts");
  let delivered = false;
  const processor = createEmailProcessor({
    findInvitation: async () => null,
    deliver: async () => void (delivered = true),
  });

  await processor({
    id: "stale-job",
    name: "invitation.email",
    data: { invitationId: "invitation-1", token: "expired" },
  } as Job<EmailJobMap[keyof EmailJobMap], void, keyof EmailJobMap>);
  assert.equal(delivered, false);
});
