import "../../src/config/load-env.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { after, before, describe, test } from "node:test";
import pg from "pg";
import { parseDatabaseEnvironment } from "../../src/config/env.ts";

describe(
  "Kanban transactions in a disposable PostgreSQL database",
  { concurrency: false },
  () => {
    const source = new URL(parseDatabaseEnvironment(process.env).DATABASE_URL);
    if (
      process.env.NODE_ENV === "production" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(source.hostname)
    )
      throw new Error("Kanban tests require a local development database.");
    const databaseName = `worksphere_test_${randomUUID().replaceAll("-", "")}`;
    const testUrl = new URL(source);
    testUrl.pathname = `/${databaseName}`;
    const adminUrl = new URL(source);
    adminUrl.pathname = "/postgres";
    adminUrl.searchParams.delete("schema");
    const admin = new pg.Client({
      connectionString: adminUrl.toString(),
      connectionTimeoutMillis: 5000,
    });
    let connected = false;
    let created = false;
    let db: (typeof import("../../src/database/client.ts"))["database"];
    let board: typeof import("../../src/modules/tasks/board.service.ts");
    let tasks: typeof import("../../src/modules/tasks/task.service.ts");
    let owner: string;
    let viewer: string;
    let outsider: string;
    let project: string;
    let foreignProject: string;
    let first: string;
    let second: string;
    const code = (expected: string) => (error: unknown) =>
      Boolean(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === expected,
      );

    before(
      async () => {
        await admin.connect();
        connected = true;
        assert.match(databaseName, /^worksphere_test_[a-f0-9]{32}$/);
        await admin.query(`CREATE DATABASE "${databaseName}"`);
        created = true;
        process.env.DATABASE_URL = testUrl.toString();
        const migration = spawnSync(
          process.execPath,
          ["node_modules/prisma/build/index.js", "migrate", "deploy"],
          {
            env: { ...process.env, NODE_ENV: "test" },
            encoding: "utf8",
            timeout: 60000,
            windowsHide: true,
          },
        );
        assert.equal(
          migration.status,
          0,
          "Migrations must apply to the empty test database",
        );
        db = (await import("../../src/database/client.ts")).database;
        board = await import("../../src/modules/tasks/board.service.ts");
        tasks = await import("../../src/modules/tasks/task.service.ts");
        owner = (
          await db.user.create({
            data: { name: "Owner", email: "owner@kanban.test" },
          })
        ).id;
        viewer = (
          await db.user.create({
            data: { name: "Viewer", email: "viewer@kanban.test" },
          })
        ).id;
        outsider = (
          await db.user.create({
            data: { name: "Outsider", email: "outside@kanban.test" },
          })
        ).id;
        const organization = await db.organization.create({
          data: {
            name: "Board",
            slug: "board",
            memberships: {
              create: [
                { userId: owner, role: "OWNER" },
                { userId: viewer, role: "VIEWER" },
              ],
            },
          },
        });
        const other = await db.organization.create({
          data: {
            name: "Other",
            slug: "other",
            memberships: { create: { userId: outsider, role: "OWNER" } },
          },
        });
        project = (
          await db.project.create({
            data: {
              name: "Project",
              slug: "project",
              organizationId: organization.id,
              ownerId: owner,
            },
          })
        ).id;
        foreignProject = (
          await db.project.create({
            data: {
              name: "Foreign",
              slug: "foreign",
              organizationId: other.id,
              ownerId: outsider,
            },
          })
        ).id;
        first = (
          await tasks.createTask(owner, { projectId: project, title: "First" })
        ).id;
        second = (
          await tasks.createTask(owner, { projectId: project, title: "Second" })
        ).id;
      },
      { timeout: 120000 },
    );

    after(async () => {
      try {
        await (
          await import("../../src/cache/redis-client.ts")
        ).closeRedisClient();
        await db?.$disconnect();
        if (created) {
          assert.match(databaseName, /^worksphere_test_[a-f0-9]{32}$/);
          assert.notEqual(databaseName, source.pathname.slice(1));
          await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
        }
      } finally {
        if (connected) await admin.end();
      }
    });

    test("moves persist within a column and into an empty column", async () => {
      const initial = await board.getBoard(owner, project);
      assert.deepEqual(
        initial.tasks.map((task) => task.position),
        [0, 1],
      );
      const reordered = await board.moveTask(owner, project, {
        taskId: first,
        status: "TODO",
        index: 1,
        revision: initial.revision,
      });
      assert.deepEqual(
        reordered.tasks.map((task) => task.id),
        [second, first],
      );
      const moved = await board.moveTask(owner, project, {
        taskId: first,
        status: "REVIEW",
        index: 0,
        revision: reordered.revision,
      });
      assert.equal(
        moved.tasks.find((task) => task.id === first)?.status,
        "REVIEW",
      );
      assert.deepEqual(await board.getBoard(owner, project), moved);
      assert.equal(
        await db.activityEvent.count({
          where: { projectId: project, action: "task.moved" },
        }),
        2,
      );
    });

    test("two concurrent moves with one revision yield exactly one winner", async () => {
      const initial = await board.getBoard(owner, project);
      const results = await Promise.allSettled([
        board.moveTask(owner, project, {
          taskId: first,
          status: "DONE",
          index: 0,
          revision: initial.revision,
        }),
        board.moveTask(owner, project, {
          taskId: second,
          status: "DONE",
          index: 0,
          revision: initial.revision,
        }),
      ]);
      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        1,
      );
      const rejected = results.find((result) => result.status === "rejected");
      assert.ok(
        rejected &&
          rejected.status === "rejected" &&
          code("CONFLICT")(rejected.reason),
      );
      const current = await board.getBoard(owner, project);
      assert.equal(current.revision, initial.revision + 1);
      assert.equal(
        current.tasks.filter((task) => task.status === "DONE").length,
        1,
      );
      await assert.rejects(
        board.moveTask(owner, project, {
          taskId: first,
          status: "TODO",
          index: 0,
          revision: initial.revision,
        }),
        code("CONFLICT"),
      );
    });

    test("authorization and project scope prevent reads, moves, and injected task IDs", async () => {
      const initial = await board.getBoard(viewer, project);
      const input = {
        taskId: first,
        status: "DONE" as const,
        index: 0,
        revision: initial.revision,
      };
      await assert.rejects(
        board.getBoard(outsider, project),
        code("NOT_FOUND"),
      );
      await assert.rejects(
        board.moveTask(viewer, project, input),
        code("FORBIDDEN"),
      );
      await assert.rejects(
        board.moveTask(outsider, project, input),
        code("NOT_FOUND"),
      );
      const foreignTask = await tasks.createTask(outsider, {
        projectId: foreignProject,
        title: "Foreign",
      });
      await assert.rejects(
        board.moveTask(owner, project, { ...input, taskId: foreignTask.id }),
        code("NOT_FOUND"),
      );
      await assert.rejects(
        board.moveTask(owner, project, { ...input, index: 100 }),
        code("BAD_REQUEST"),
      );
      assert.deepEqual(await board.getBoard(owner, project), initial);
    });

    test("regular task creation, updates, and deletion invalidate stale boards", async () => {
      const initial = await board.getBoard(owner, project);
      const task = await tasks.createTask(owner, {
        projectId: project,
        title: "Added",
        status: "DONE",
      });
      assert.equal(task.status, "DONE");
      assert.equal(task.position, 1);
      await assert.rejects(
        board.moveTask(owner, project, {
          taskId: first,
          status: "TODO",
          index: 0,
          revision: initial.revision,
        }),
        code("CONFLICT"),
      );
      await tasks.updateTask(owner, task.id, { status: "IN_PROGRESS" });
      await tasks.deleteTask(owner, task.id);
      assert.equal(
        (await board.getBoard(owner, project)).revision,
        initial.revision + 3,
      );
    });

    test("assignments, reminders, and status changes create preference-aware notifications", async () => {
      const dueDate = new Date(Date.now() + 86_400_000).toISOString();
      const task = await tasks.createTask(owner, {
        projectId: project,
        title: "Notify assignee",
        assigneeId: viewer,
        dueDate,
      });
      await tasks.updateTask(owner, task.id, { status: "IN_PROGRESS" });

      assert.deepEqual(
        (
          await db.notification.findMany({
            where: { recipientId: viewer, taskId: task.id },
            orderBy: { createdAt: "asc" },
            select: { kind: true },
          })
        ).map((notification) => notification.kind),
        ["ASSIGNMENT", "REMINDER", "STATUS_CHANGE"],
      );
      assert.equal(
        (
          await db.activityEvent.findMany({
            where: {
              projectId: project,
              action: { in: ["task.assigned", "task.status_changed"] },
            },
            select: { metadata: true },
          })
        ).filter(
          (event) =>
            event.metadata &&
            typeof event.metadata === "object" &&
            !Array.isArray(event.metadata) &&
            event.metadata.taskId === task.id,
        ).length,
        2,
      );

      await db.notificationPreference.create({
        data: { userId: viewer, assignmentInApp: false },
      });
      const muted = await tasks.createTask(owner, {
        projectId: project,
        title: "Muted assignment",
        assigneeId: viewer,
      });
      assert.equal(
        await db.notification.count({
          where: { recipientId: viewer, taskId: muted.id, kind: "ASSIGNMENT" },
        }),
        0,
      );
    });

    test("activity failure rolls back the move and board revision together", async () => {
      const initial = await board.getBoard(owner, project);
      await db.$executeRawUnsafe(
        `CREATE FUNCTION reject_move() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'task.moved' THEN RAISE EXCEPTION 'test failure'; END IF; RETURN NEW; END $$`,
      );
      await db.$executeRawUnsafe(
        `CREATE TRIGGER reject_move BEFORE INSERT ON "ActivityEvent" FOR EACH ROW EXECUTE FUNCTION reject_move()`,
      );
      try {
        await assert.rejects(
          board.moveTask(owner, project, {
            taskId: first,
            status: "TODO",
            index: 0,
            revision: initial.revision,
          }),
        );
        assert.deepEqual(await board.getBoard(owner, project), initial);
      } finally {
        await db.$executeRawUnsafe(
          `DROP TRIGGER reject_move ON "ActivityEvent"`,
        );
      }
    });
  },
);
