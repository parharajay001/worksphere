import assert from "node:assert/strict";
import test from "node:test";
import {
  createTaskSchema,
  taskFilterSchema,
} from "../src/modules/tasks/task.schemas.ts";

test("task schemas validate fields and filter dimensions", () => {
  const projectId = "00000000-0000-4000-8000-000000000001";
  assert.equal(
    createTaskSchema.parse({
      projectId,
      title: "Ship release",
      priority: "HIGH",
    }).priority,
    "HIGH",
  );
  assert.equal(
    taskFilterSchema.parse({ projectId, status: "DONE" }).status,
    "DONE",
  );
  assert.throws(() => createTaskSchema.parse({ projectId, title: "" }));
  assert.throws(() => taskFilterSchema.parse({ projectId, unknown: "x" }));
});
