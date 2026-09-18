import "../../src/config/load-env.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { after, before, describe, test } from "node:test";
import pg from "pg";
import { parseDatabaseEnvironment } from "../../src/config/env.ts";

describe("tenant-scoped chat in a disposable PostgreSQL database", () => {
  const source = new URL(parseDatabaseEnvironment(process.env).DATABASE_URL);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(source.hostname))
    throw new Error("Chat tests require a local development database.");
  const databaseName = `worksphere_test_${randomUUID().replaceAll("-", "")}`;
  const testUrl = new URL(source);
  testUrl.pathname = `/${databaseName}`;
  const adminUrl = new URL(source);
  adminUrl.pathname = "/postgres";
  adminUrl.searchParams.delete("schema");
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  let db: (typeof import("../../src/database/client.ts"))["database"];
  let chat: typeof import("../../src/modules/chat/chat.service.ts");
  let projects: typeof import("../../src/modules/projects/project.service.ts");
  let teams: typeof import("../../src/modules/teams/team.service.ts");
  let billing: typeof import("../../src/modules/billing/billing.service.ts");
  let webhooks: typeof import("../../src/modules/billing/webhook.service.ts");
  let analytics: typeof import("../../src/modules/analytics/analytics.service.ts");
  let audit: typeof import("../../src/modules/audit/audit.service.ts");
  let owner = "";
  let member = "";
  let outsider = "";
  let project = "";
  let team = "";
  const appCode = (expected: string) => (error: unknown) =>
    Boolean(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === expected,
    );

  before(
    async () => {
      await admin.connect();
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      const migration = spawnSync(
        process.execPath,
        ["node_modules/prisma/build/index.js", "migrate", "deploy"],
        {
          env: {
            ...process.env,
            NODE_ENV: "test",
            DATABASE_URL: testUrl.toString(),
          },
          encoding: "utf8",
        },
      );
      assert.equal(migration.status, 0);
      process.env.DATABASE_URL = testUrl.toString();
      db = (await import("../../src/database/client.ts")).database;
      chat = await import("../../src/modules/chat/chat.service.ts");
      projects = await import("../../src/modules/projects/project.service.ts");
      teams = await import("../../src/modules/teams/team.service.ts");
      billing = await import("../../src/modules/billing/billing.service.ts");
      webhooks = await import("../../src/modules/billing/webhook.service.ts");
      analytics =
        await import("../../src/modules/analytics/analytics.service.ts");
      audit = await import("../../src/modules/audit/audit.service.ts");
      owner = (
        await db.user.create({
          data: { name: "Owner", email: "chat-owner@test.example" },
        })
      ).id;
      member = (
        await db.user.create({
          data: { name: "Member", email: "chat-member@test.example" },
        })
      ).id;
      outsider = (
        await db.user.create({
          data: { name: "Outsider", email: "chat-outsider@test.example" },
        })
      ).id;
      const organization = await db.organization.create({
        data: {
          name: "Chat",
          slug: "chat",
          memberships: {
            create: [
              { userId: owner, role: "OWNER" },
              { userId: member, role: "MEMBER" },
            ],
          },
        },
      });
      const other = await db.organization.create({
        data: {
          name: "Other",
          slug: "other-chat",
          memberships: { create: { userId: outsider, role: "OWNER" } },
        },
      });
      project = (
        await db.project.create({
          data: {
            organizationId: organization.id,
            ownerId: owner,
            name: "Project chat",
            slug: "project-chat",
          },
        })
      ).id;
      team = (
        await db.team.create({
          data: {
            organizationId: organization.id,
            name: "Team chat",
            slug: "team-chat",
            memberships: { create: { userId: member } },
          },
        })
      ).id;
      await db.project.create({
        data: {
          organizationId: other.id,
          ownerId: outsider,
          name: "Other",
          slug: "other",
        },
      });
    },
    { timeout: 120000 },
  );

  after(async () => {
    await (await import("../../src/cache/redis-client.ts")).closeRedisClient();
    await db?.$disconnect();
    await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await admin.end();
  });

  test("persists project history/read state and blocks cross-tenant access", async () => {
    const conversation = await chat.ensureConversation(owner, {
      projectId: project,
    });
    await chat.createMessage(owner, conversation.id, { body: "first" });
    await chat.createMessage(member, conversation.id, { body: "second" });
    const page = await chat.listMessages(member, conversation.id, { limit: 1 });
    assert.deepEqual(
      page.messages.map((message) => message.body),
      ["second"],
    );
    assert.ok(page.nextCursor);
    assert.ok(await chat.markConversationRead(member, conversation.id));
    const ownerView = await chat.listMessages(owner, conversation.id, {
      limit: 20,
    });
    assert.equal(ownerView.readBy[0]?.userId, member);
    assert.equal(ownerView.readBy[0]?.name, "Member");
    await assert.rejects(
      chat.listMessages(outsider, conversation.id, { limit: 20 }),
      appCode("NOT_FOUND"),
    );
  });

  test("supports team chat while excluding non-team members", async () => {
    const conversation = await chat.ensureConversation(member, {
      teamId: team,
    });
    assert.equal(conversation.kind, "TEAM");
    assert.equal((await teams.getTeam(member, team)).id, team);
    await assert.rejects(
      chat.ensureConversation(outsider, { teamId: team }),
      appCode("NOT_FOUND"),
    );
  });

  test("enforces Free project limits and processes subscription webhooks once", async () => {
    const organizationId = (
      await db.project.findUniqueOrThrow({
        where: { id: project },
        select: { organizationId: true },
      })
    ).organizationId;
    await projects.createProject(owner, { organizationId, name: "Second" });
    await projects.createProject(owner, { organizationId, name: "Third" });
    await assert.rejects(
      projects.createProject(owner, { organizationId, name: "Fourth" }),
      appCode("PLAN_LIMIT_REACHED"),
    );

    const event = {
      id: "billing-event-1",
      type: "subscription.updated" as const,
      data: {
        organizationId,
        customerId: "customer-1",
        subscriptionId: "subscription-1",
        plan: "PRO" as const,
        status: "ACTIVE" as const,
        currentPeriodEnd: "2026-10-16T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      },
    };
    const raw = new TextEncoder().encode(JSON.stringify(event));
    assert.deepEqual(await webhooks.processBillingWebhook("test", event, raw), {
      duplicate: false,
    });
    assert.deepEqual(await webhooks.processBillingWebhook("test", event, raw), {
      duplicate: true,
    });
    assert.equal(await billing.effectivePlan(db, organizationId), "PRO");
    assert.equal(
      (await projects.createProject(owner, { organizationId, name: "Fourth" }))
        .name,
      "Fourth",
    );
    assert.equal(
      await db.billingWebhookEvent.count({
        where: { externalEventId: event.id },
      }),
      1,
    );

    const canceledEvent = {
      ...event,
      id: "billing-event-2",
      type: "subscription.canceled" as const,
      data: {
        ...event.data,
        status: "CANCELED" as const,
        cancelAtPeriodEnd: false,
      },
    };
    const canceledRaw = new TextEncoder().encode(JSON.stringify(canceledEvent));
    assert.deepEqual(
      await webhooks.processBillingWebhook("test", canceledEvent, canceledRaw),
      { duplicate: false },
    );
    assert.equal(await billing.effectivePlan(db, organizationId), "FREE");

    const checkout = await billing.startCheckout(
      owner,
      organizationId,
      "TEAM",
      "http://localhost:3000/settings/billing",
    );
    assert.match(checkout.checkoutUrl, /billing=updated/);
    assert.equal(await billing.effectivePlan(db, organizationId), "TEAM");
    await billing.changePlan(owner, organizationId, "PRO");
    assert.equal(await billing.effectivePlan(db, organizationId), "PRO");
    const portal = await billing.openCustomerPortal(
      owner,
      organizationId,
      "http://localhost:3000/settings/billing",
    );
    assert.match(portal.portalUrl, /billing=updated/);
    await billing.cancelPlan(owner, organizationId);
    assert.equal(
      (
        await db.billingSubscription.findUniqueOrThrow({
          where: { organizationId },
        })
      ).cancelAtPeriodEnd,
      true,
    );
  });

  test("serves tenant KPIs and keeps sensitive audit rows immutable", async () => {
    const organizationId = (
      await db.project.findUniqueOrThrow({
        where: { id: project },
        select: { organizationId: true },
      })
    ).organizationId;
    await db.task.create({
      data: {
        projectId: project,
        reporterId: owner,
        title: "Measured",
        status: "DONE",
      },
    });
    await db.activityEvent.create({
      data: { projectId: project, actorId: owner, action: "task.created" },
    });
    const snapshot = await analytics.getAnalytics(owner, organizationId);
    assert.ok(snapshot.analytics.projects >= 3);
    assert.equal(snapshot.analytics.tasksByStatus.DONE, 1);
    assert.equal(snapshot.analytics.activeUsers30d, 1);
    await assert.rejects(
      analytics.getAnalytics(outsider, organizationId),
      appCode("NOT_FOUND"),
    );

    const ledger = await audit.listAuditEvents(owner, {
      organizationId,
      limit: 50,
    });
    assert.ok(
      ledger.events.some(
        (event) => event.action === "billing.subscription_changed",
      ),
    );
    const eventId = ledger.events[0]!.id;
    await assert.rejects(
      db.auditEvent.update({
        where: { id: eventId },
        data: { action: "tampered" },
      }),
      /immutable/,
    );
    await assert.rejects(
      db.auditEvent.delete({ where: { id: eventId } }),
      /immutable/,
    );
  });
});
