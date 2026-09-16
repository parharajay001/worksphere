import "../../src/config/load-env.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { after, before, describe, test } from "node:test";
import pg from "pg";
import { parseDatabaseEnvironment } from "../../src/config/env.ts";

describe(
  "task comments in a disposable PostgreSQL database",
  { concurrency: false },
  () => {
    const source = new URL(parseDatabaseEnvironment(process.env).DATABASE_URL);
    if (
      process.env.NODE_ENV === "production" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(source.hostname)
    )
      throw new Error("Comment tests require a local development database.");
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
    let comments: typeof import("../../src/modules/comments/comment.service.ts");
    let owner = "";
    let member = "";
    let outsider = "";
    let task = "";
    let project = "";
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
        connected = true;
        assert.match(databaseName, /^worksphere_test_[a-f0-9]{32}$/);
        await admin.query(`CREATE DATABASE "${databaseName}"`);
        created = true;
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
            timeout: 60000,
            windowsHide: true,
          },
        );
        assert.equal(
          migration.status,
          0,
          "Migrations must apply to the empty comment database",
        );
        process.env.DATABASE_URL = testUrl.toString();
        db = (await import("../../src/database/client.ts")).database;
        comments =
          await import("../../src/modules/comments/comment.service.ts");
        owner = (
          await db.user.create({
            data: { name: "Owner", email: "comment-owner@test.example" },
          })
        ).id;
        member = (
          await db.user.create({
            data: { name: "Member", email: "comment-member@test.example" },
          })
        ).id;
        outsider = (
          await db.user.create({
            data: { name: "Outsider", email: "comment-outsider@test.example" },
          })
        ).id;
        const organization = await db.organization.create({
          data: {
            name: "Comments",
            slug: "comments",
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
            name: "Other Comments",
            slug: "other-comments",
            memberships: { create: { userId: outsider, role: "OWNER" } },
          },
        });
        project = (
          await db.project.create({
            data: {
              organizationId: organization.id,
              ownerId: owner,
              name: "Thread",
              slug: "thread",
            },
          })
        ).id;
        task = (
          await db.task.create({
            data: {
              projectId: project,
              reporterId: owner,
              title: "Discuss release",
            },
          })
        ).id;
        await db.project.create({
          data: {
            organizationId: other.id,
            ownerId: outsider,
            name: "Other thread",
            slug: "other-thread",
          },
        });
      },
      { timeout: 120000 },
    );

    after(async () => {
      try {
        await db?.$disconnect();
        if (created) {
          assert.match(databaseName, /^worksphere_test_[a-f0-9]{32}$/);
          await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
        }
      } finally {
        if (connected) await admin.end();
      }
    });

    test("creates comments, paginates newest-first, and records events", async () => {
      const createdComments = [];
      for (const body of ["first", "second", "third"])
        createdComments.push(
          await comments.createComment(owner, task, { body }),
        );
      const firstPage = await comments.listComments(member, task, { limit: 2 });
      assert.deepEqual(
        firstPage.comments.map((comment) => comment.body),
        ["third", "second"],
      );
      assert.ok(firstPage.nextCursor);
      const secondPage = await comments.listComments(member, task, {
        limit: 2,
        cursor: firstPage.nextCursor!,
      });
      assert.deepEqual(
        secondPage.comments.map((comment) => comment.body),
        ["first"],
      );
      assert.equal(secondPage.nextCursor, null);
      assert.equal(
        await db.activityEvent.count({
          where: { projectId: project, action: "comment.created" },
        }),
        3,
      );
      await assert.rejects(
        comments.listComments(member, task, {
          limit: 1,
          cursor: randomUUID(),
        }),
        appCode("BAD_REQUEST"),
      );
    });

    test("authors can edit/delete, managers can moderate, and outsiders cannot access", async () => {
      const own = await comments.createComment(member, task, {
        body: "member note",
      });
      const edited = await comments.updateComment(member, own.id, {
        body: "edited note",
      });
      assert.equal(edited.body, "edited note");
      await assert.rejects(
        comments.updateComment(outsider, own.id, { body: "stolen" }),
        appCode("NOT_FOUND"),
      );
      const ownerComment = await comments.createComment(owner, task, {
        body: "owner note",
      });
      await assert.rejects(
        comments.updateComment(member, ownerComment.id, { body: "stolen" }),
        appCode("FORBIDDEN"),
      );
      await assert.rejects(
        comments.deleteComment(member, ownerComment.id),
        appCode("FORBIDDEN"),
      );
      await comments.deleteComment(owner, ownerComment.id);
      await comments.deleteComment(member, own.id);
      const moderated = await comments.createComment(member, task, {
        body: "moderate me",
      });
      await comments.updateComment(owner, moderated.id, { body: "moderated" });
      await comments.deleteComment(owner, moderated.id);
      assert.equal(await db.comment.count({ where: { taskId: task } }), 3);
      assert.equal(
        await db.activityEvent.count({
          where: { projectId: project, action: "comment.updated" },
        }),
        2,
      );
      assert.equal(
        await db.activityEvent.count({
          where: { projectId: project, action: "comment.deleted" },
        }),
        3,
      );
      await assert.rejects(
        comments.listComments(outsider, task, { limit: 20 }),
        appCode("NOT_FOUND"),
      );
    });

    test("database rejects blank comment bodies", async () => {
      await assert.rejects(
        db.comment.create({
          data: { taskId: task, authorId: owner, body: "   " },
        }),
        /Comment_body_nonempty/,
      );
    });
  },
);
