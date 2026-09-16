import assert from "node:assert/strict";
import test from "node:test";
import { reorderTasks } from "../src/modules/tasks/board.ts";
import { moveTaskSchema } from "../src/modules/tasks/board.schemas.ts";

test("moving between columns normalizes positions without losing or mutating tasks", () => {
  const tasks = [
    { id: "a", status: "TODO" as const, position: 0 },
    { id: "b", status: "TODO" as const, position: 5 },
    { id: "c", status: "DONE" as const, position: 2 },
  ];
  const moved = reorderTasks(tasks, "a", "DONE", 1);
  assert.deepEqual(moved, [
    { id: "b", status: "TODO", position: 0 },
    { id: "c", status: "DONE", position: 0 },
    { id: "a", status: "DONE", position: 1 },
  ]);
  assert.equal(tasks[0]?.status, "TODO");
  assert.deepEqual(
    reorderTasks(tasks, "a", "TODO", 1).map((task) => task.id),
    ["b", "a", "c"],
  );
  assert.equal(
    reorderTasks(tasks, "a", "REVIEW", 0).find((task) => task.id === "a")
      ?.position,
    0,
  );
  assert.throws(() => reorderTasks(tasks, "missing", "TODO", 0));
  assert.throws(() => reorderTasks(tasks, "a", "TODO", 2));
});

test("move validation requires a revision and rejects invalid or injected fields", () => {
  const input = {
    taskId: "00000000-0000-4000-8000-000000000001",
    status: "DONE",
    index: 0,
    revision: 2,
  };
  assert.deepEqual(moveTaskSchema.parse(input), input);
  for (const fields of [
    { revision: undefined },
    { revision: -1 },
    { index: -1 },
    { index: 1.5 },
    { status: "OTHER" },
    { projectId: input.taskId },
  ]) {
    assert.equal(
      moveTaskSchema.safeParse({ ...input, ...fields }).success,
      false,
    );
  }
});
