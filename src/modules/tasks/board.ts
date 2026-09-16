export const taskStatuses = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;
export type TaskStatus = (typeof taskStatuses)[number];
export const statusLabels: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  REVIEW: "Review",
  DONE: "Done",
};

export type BoardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  position: number;
  dueDate: string | null;
  assignee: { id: string; name: string; email: string } | null;
};
export type Board = { revision: number; tasks: BoardTask[] };

// Destination indices refer to the column after removing the moving task.
export function reorderTasks<
  T extends { id: string; status: TaskStatus; position: number },
>(tasks: readonly T[], taskId: string, status: TaskStatus, index: number): T[] {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) throw new Error("Task not found");
  const destination = tasks
    .filter((item) => item.status === status && item.id !== taskId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  if (!Number.isInteger(index) || index < 0 || index > destination.length)
    throw new Error("Invalid destination index");
  destination.splice(index, 0, { ...task, status });
  return taskStatuses.flatMap((column) => {
    const items =
      column === status
        ? destination
        : tasks
            .filter((item) => item.status === column && item.id !== taskId)
            .sort(
              (a, b) => a.position - b.position || a.id.localeCompare(b.id),
            );
    return items.map((item, position) => ({ ...item, position }));
  });
}
