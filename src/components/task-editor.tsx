"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";

type Person = { id: string; name: string; email: string };
type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigneeId: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  reporter: Person;
};
type ApiError = {
  error?: { message?: string; details?: Array<{ message: string }> };
};
const statuses = [
  ["TODO", "To do"],
  ["IN_PROGRESS", "In progress"],
  ["REVIEW", "Review"],
  ["DONE", "Done"],
] as const;
const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}
function displayDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}
async function responseError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as ApiError;
  return (
    body.error?.details?.[0]?.message ?? body.error?.message ?? "Try again."
  );
}

export function TaskEditor({
  initialTask,
  members,
  projectName,
  canManage,
}: {
  initialTask: Task;
  members: Person[];
  projectName: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [task, setTask] = useState(initialTask);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteValue, setDeleteValue] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    const dueDate = String(form.get("dueDate") ?? "");
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: String(form.get("title") ?? ""),
          description: String(form.get("description") ?? ""),
          status: String(form.get("status")),
          priority: String(form.get("priority")),
          assigneeId: form.get("assigneeId")
            ? String(form.get("assigneeId"))
            : null,
          dueDate: dueDate
            ? new Date(`${dueDate}T00:00:00.000Z`).toISOString()
            : null,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const result = (await response.json()) as { data: { task: Task } };
      setTask({
        ...result.data.task,
        createdAt: task.createdAt,
        reporter: task.reporter,
      });
      setEditing(false);
      setSuccess("Task details saved.");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Task details could not be saved.",
      );
    } finally {
      setPending(false);
    }
  }

  async function deleteTask() {
    if (deleteValue !== task.title) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await responseError(response));
      router.push(`/projects/${task.projectId}`);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Task could not be deleted.",
      );
      setPending(false);
    }
  }

  return (
    <>
      <div className="task-editor-status" aria-live="polite">
        {error && (
          <p className="settings-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="settings-success">
            <Check size={15} aria-hidden="true" />
            {success}
          </p>
        )}
      </div>
      {editing ? (
        <form className="task-edit-form" onSubmit={save}>
          <label>
            Title
            <input
              name="title"
              required
              maxLength={200}
              defaultValue={task.title}
            />
          </label>
          <label>
            Description <span>Optional</span>
            <textarea
              name="description"
              maxLength={5000}
              defaultValue={task.description ?? ""}
              placeholder="Add context, acceptance criteria, or useful links"
            />
          </label>
          <div className="task-edit-grid">
            <label>
              Status
              <select name="status" defaultValue={task.status}>
                {statuses.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select name="priority" defaultValue={task.priority}>
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assignee
              <select name="assigneeId" defaultValue={task.assigneeId ?? ""}>
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Due date
              <input
                name="dueDate"
                type="date"
                defaultValue={dateInputValue(task.dueDate)}
              />
            </label>
          </div>
          <div className="settings-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setEditing(false)}
              disabled={pending}
            >
              <X size={15} aria-hidden="true" /> Cancel
            </button>
            <button type="submit" className="primary-link" disabled={pending}>
              {pending ? "Saving…" : "Save Task"}
            </button>
          </div>
        </form>
      ) : (
        <div className="task-detail-layout">
          <div className="task-detail-main">
            <span className="issue-key">
              TASK · {task.id.slice(0, 8).toUpperCase()}
            </span>
            <div className="task-title-actions">
              <h1>{task.title}</h1>
              {canManage && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setEditing(true)}
                >
                  <Pencil size={15} aria-hidden="true" /> Edit Task
                </button>
              )}
            </div>
            <section className="task-description">
              <h2>Description</h2>
              <p>{task.description || "No description has been added yet."}</p>
            </section>
          </div>
          <aside className="task-properties">
            <h2>Details</h2>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className="status-lozenge">
                    {statuses.find(([value]) => value === task.status)?.[1]}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd className={`priority-${task.priority.toLowerCase()}`}>
                  {task.priority.toLowerCase()}
                </dd>
              </div>
              <div>
                <dt>Assignee</dt>
                <dd>
                  {members.find((member) => member.id === task.assigneeId)
                    ?.name ?? "Unassigned"}
                </dd>
              </div>
              <div>
                <dt>Reporter</dt>
                <dd>{task.reporter.name}</dd>
              </div>
              <div>
                <dt>Project</dt>
                <dd>
                  <Link href={`/projects/${task.projectId}`}>
                    {projectName}
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Due date</dt>
                <dd>{task.dueDate ? displayDate(task.dueDate) : "Not set"}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>
                  <time dateTime={task.createdAt}>
                    {displayDate(task.createdAt)}
                  </time>
                </dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>
                  <time dateTime={task.updatedAt}>
                    {displayDate(task.updatedAt)}
                  </time>
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      )}
      {canManage && !editing && (
        <section
          className="task-danger-zone"
          aria-labelledby="delete-task-title"
        >
          <div>
            <h2 id="delete-task-title">Delete task</h2>
            <p>
              This removes the task, its comments, and activity references
              permanently.
            </p>
          </div>
          <label>
            Type <strong>{task.title}</strong> to confirm
            <input
              value={deleteValue}
              onChange={(event) => setDeleteValue(event.target.value)}
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            className="danger-button"
            disabled={pending || deleteValue !== task.title}
            onClick={() => void deleteTask()}
          >
            <Trash2 size={15} aria-hidden="true" /> Delete Task
          </button>
        </section>
      )}
    </>
  );
}
