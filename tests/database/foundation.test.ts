import "../../src/config/load-env.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { after, before, describe, test } from "node:test";
import pg from "pg";
import { parseDatabaseEnvironment } from "../../src/config/env.ts";
import { createDatabaseClient } from "../../src/database/create-client.ts";
import { seedDevelopmentData } from "../../prisma/seed-data.ts";

describe("PostgreSQL foundation", { concurrency: false }, () => {
  const source = new URL(parseDatabaseEnvironment(process.env).DATABASE_URL);
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(source.hostname)
  ) {
    throw new Error(
      "Database integration tests require a local development PostgreSQL server.",
    );
  }

  // Only this newly created database is migrated, seeded, and removed.
  const databaseName = `worksphere_test_${randomUUID().replaceAll("-", "")}`;
  const testUrl = new URL(source);
  testUrl.pathname = `/${databaseName}`;
  testUrl.searchParams.set("schema", "public");
  const adminUrl = new URL(source);
  adminUrl.pathname = "/postgres";
  adminUrl.searchParams.delete("schema");
  const admin = new pg.Client({
    connectionString: adminUrl.toString(),
    connectionTimeoutMillis: 5_000,
  });
  const database = createDatabaseClient(testUrl.toString());
  let created = false;
  let connected = false;

  function prisma(...args: string[]) {
    const result = spawnSync(
      process.execPath,
      ["node_modules/prisma/build/index.js", ...args],
      {
        env: {
          ...process.env,
          NODE_ENV: "test",
          DATABASE_URL: testUrl.toString(),
        },
        encoding: "utf8",
        timeout: 60_000,
        windowsHide: true,
      },
    );
    assert.equal(
      result.error,
      undefined,
      `Prisma ${args.join(" ")} must complete`,
    );
    assert.equal(
      result.status,
      0,
      `Prisma ${args.join(" ")} must succeed in the disposable database`,
    );
    return result.stdout;
  }

  before(
    async () => {
      await admin.connect();
      connected = true;
      assert.match(databaseName, /^worksphere_test_[a-f0-9]{32}$/);
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      created = true;
      prisma("migrate", "deploy");
    },
    { timeout: 120_000 },
  );

  after(async () => {
    try {
      await database.$disconnect();
      if (created) {
        assert.match(databaseName, /^worksphere_test_[a-f0-9]{32}$/);
        assert.notEqual(databaseName, source.pathname.slice(1));
        await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      }
    } finally {
      if (connected) await admin.end();
    }
  });

  test("migrations build every model from empty and can be applied again", async () => {
    assert.equal(await database.user.count(), 0);
    assert.equal(await database.account.count(), 0);
    assert.equal(await database.session.count(), 0);
    assert.equal(await database.organization.count(), 0);
    assert.equal(await database.membership.count(), 0);
    assert.match(prisma("migrate", "deploy"), /No pending migrations/);
    assert.match(prisma("migrate", "status"), /up to date/);
  });

  test("seed CLI is repeatable and creates a populated local demo", async () => {
    prisma("db", "seed");
    const beforeSeed = await database.user.findMany({
      orderBy: { email: "asc" },
    });
    const beforeMemberships = await database.membership.findMany({
      orderBy: { id: "asc" },
    });
    prisma("db", "seed");
    assert.deepEqual(
      await database.user.findMany({ orderBy: { email: "asc" } }),
      beforeSeed,
    );
    assert.deepEqual(
      await database.membership.findMany({ orderBy: { id: "asc" } }),
      beforeMemberships,
    );
    assert.equal(beforeSeed.length, 5);
    assert.equal(beforeMemberships.length, 6);
    assert.equal(await database.organization.count(), 2);
    assert.equal(await database.account.count(), 0);
    assert.equal(await database.session.count(), 0);
    assert.equal(await database.team.count(), 3);
    assert.equal(await database.project.count(), 4);
    assert.equal(await database.task.count(), 18);
    assert.equal(await database.comment.count(), 5);
    assert.equal(await database.activityEvent.count(), 12);
    assert.equal(await database.notification.count(), 4);
    assert.equal(await database.chatMessage.count(), 3);
    assert.equal(await database.auditEvent.count(), 5);
    const demoOwner = beforeSeed.find(
      (user) => user.email === "owner@worksphere.example",
    );
    assert.ok(demoOwner?.passwordHash?.startsWith("scrypt$"));
    assert.ok(demoOwner?.emailVerifiedAt);
    assert.ok(
      beforeSeed
        .filter((user) => user.email !== "owner@worksphere.example")
        .every((user) => user.passwordHash === null),
    );
  });

  test("re-seeding preserves edits to existing demo records", async () => {
    const user = await database.user.update({
      where: { email: "member@worksphere.example" },
      data: { name: "Edited locally" },
    });
    await database.membership.updateMany({
      where: { userId: user.id },
      data: { role: "VIEWER" },
    });
    await seedDevelopmentData(database);
    assert.equal(
      (await database.user.findUniqueOrThrow({ where: { id: user.id } })).name,
      "Edited locally",
    );
    assert.equal(
      (
        await database.membership.findFirstOrThrow({
          where: { userId: user.id },
        })
      ).role,
      "VIEWER",
    );
  });

  test("unique constraints reject duplicate identities and memberships", async () => {
    const user = await database.user.findUniqueOrThrow({
      where: { email: "owner@worksphere.example" },
    });
    const organization = await database.organization.findUniqueOrThrow({
      where: { slug: "worksphere-demo" },
    });
    const uniqueViolation = (error: unknown) =>
      Boolean(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002",
      );
    await assert.rejects(
      database.user.create({ data: { email: user.email, name: "Duplicate" } }),
      uniqueViolation,
    );
    await assert.rejects(
      database.organization.create({
        data: { slug: organization.slug, name: "Duplicate" },
      }),
      uniqueViolation,
    );
    await assert.rejects(
      database.membership.create({
        data: { userId: user.id, organizationId: organization.id },
      }),
      uniqueViolation,
    );
    const account = {
      userId: user.id,
      provider: "test-provider",
      providerAccountId: "external-id",
    };
    await database.account.create({ data: account });
    await assert.rejects(
      database.account.create({ data: account }),
      uniqueViolation,
    );
    const session = {
      userId: user.id,
      tokenHash: "a".repeat(64),
      expiresAt: new Date(Date.now() + 3_600_000),
    };
    await database.session.create({ data: session });
    await assert.rejects(
      database.session.create({ data: session }),
      uniqueViolation,
    );
  });

  test("tenant queries cannot cross organization membership boundaries", async () => {
    const owner = await database.user.findUniqueOrThrow({
      where: { email: "owner@worksphere.example" },
    });
    const manager = await database.user.findUniqueOrThrow({
      where: { email: "manager@worksphere.example" },
    });
    const demo = await database.organization.findUniqueOrThrow({
      where: { slug: "worksphere-demo" },
    });
    const labs = await database.organization.findUniqueOrThrow({
      where: { slug: "worksphere-labs" },
    });
    assert.ok(
      await database.membership.findUnique({
        where: {
          organizationId_userId: { organizationId: labs.id, userId: owner.id },
        },
      }),
    );
    assert.equal(
      await database.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: labs.id,
            userId: manager.id,
          },
        },
      }),
      null,
    );
    const members = await database.membership.findMany({
      where: { organizationId: labs.id },
    });
    assert.ok(
      members.every((membership) => membership.organizationId === labs.id),
    );
    assert.notEqual(demo.id, labs.id);
  });

  test("foreign keys reject missing users and organizations", async () => {
    const user = await database.user.findUniqueOrThrow({
      where: { email: "owner@worksphere.example" },
    });
    const organization = await database.organization.findUniqueOrThrow({
      where: { slug: "worksphere-demo" },
    });
    const foreignKeyViolation = (error: unknown) =>
      Boolean(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2003",
      );
    await assert.rejects(
      database.membership.create({
        data: { organizationId: organization.id, userId: randomUUID() },
      }),
      foreignKeyViolation,
    );
    await assert.rejects(
      database.membership.create({
        data: { organizationId: randomUUID(), userId: user.id },
      }),
      foreignKeyViolation,
    );
    await assert.rejects(
      database.account.create({
        data: {
          userId: randomUUID(),
          provider: "test",
          providerAccountId: "missing",
        },
      }),
      foreignKeyViolation,
    );
    await assert.rejects(
      database.session.create({
        data: {
          userId: randomUUID(),
          tokenHash: "b".repeat(64),
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      }),
      foreignKeyViolation,
    );
  });

  test("a failed transaction rolls back organization creation", async () => {
    await assert.rejects(
      database.$transaction(async (transaction) => {
        const organization = await transaction.organization.create({
          data: { slug: "rolled-back", name: "Must roll back" },
        });
        await transaction.membership.create({
          data: {
            organizationId: organization.id,
            userId: randomUUID(),
            role: "OWNER",
          },
        });
      }),
    );
    assert.equal(
      await database.organization.findUnique({
        where: { slug: "rolled-back" },
      }),
      null,
    );
  });

  test("SQL checks reject noncanonical identity keys and invalid session storage", async () => {
    const user = await database.user.findUniqueOrThrow({
      where: { email: "owner@worksphere.example" },
    });
    await assert.rejects(
      database.user.create({
        data: { email: "OWNER@worksphere.example", name: "Case duplicate" },
      }),
      /User_email_normalized_check/,
    );
    await assert.rejects(
      database.organization.create({
        data: { slug: "Invalid Slug", name: "Invalid slug" },
      }),
      /Organization_slug_format_check/,
    );
    await assert.rejects(
      database.session.create({
        data: {
          userId: user.id,
          tokenHash: "raw-token",
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      }),
      /Session_token_hash_check/,
    );
    await assert.rejects(
      database.session.create({
        data: {
          userId: user.id,
          tokenHash: "d".repeat(64),
          createdAt: new Date("2026-01-02"),
          expiresAt: new Date("2026-01-01"),
        },
      }),
      /Session_expiry_check/,
    );
  });

  test("deletion cascades remove dependants without deleting unrelated parent records", async () => {
    const user = await database.user.create({
      data: { email: "cascade@worksphere.example", name: "Cascade test" },
    });
    const organization = await database.organization.create({
      data: { slug: "cascade-test", name: "Cascade test" },
    });
    await database.membership.create({
      data: { userId: user.id, organizationId: organization.id },
    });
    await database.account.create({
      data: {
        userId: user.id,
        provider: "test",
        providerAccountId: "cascade-test",
      },
    });
    await database.session.create({
      data: {
        userId: user.id,
        tokenHash: "c".repeat(64),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    await database.user.delete({ where: { id: user.id } });
    assert.equal(
      await database.membership.count({ where: { userId: user.id } }),
      0,
    );
    assert.equal(
      await database.account.count({ where: { userId: user.id } }),
      0,
    );
    assert.equal(
      await database.session.count({ where: { userId: user.id } }),
      0,
    );
    assert.ok(
      await database.organization.findUnique({
        where: { id: organization.id },
      }),
    );
    const survivor = await database.user.findUniqueOrThrow({
      where: { email: "owner@worksphere.example" },
    });
    await database.membership.create({
      data: { userId: survivor.id, organizationId: organization.id },
    });
    await database.organization.delete({ where: { id: organization.id } });
    assert.equal(
      await database.membership.count({
        where: { organizationId: organization.id },
      }),
      0,
    );
    assert.ok(await database.user.findUnique({ where: { id: survivor.id } }));
  });
});
