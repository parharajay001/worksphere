import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/modules/auth/session";
import { getTask } from "@/modules/tasks/task.service";
import { listComments } from "@/modules/comments/comment.service";
import { TaskComments } from "@/components/task-comments";
import { requirePermission } from "@/modules/authorization/guards";
import { hasPermission } from "@/modules/authorization/permissions";
import { AppError } from "@/lib/api/errors";
import { taskIdSchema } from "@/modules/tasks/task.schemas";
import { listMentionCandidates } from "@/modules/comments/mentions";
import { getProject } from "@/modules/projects/project.service";
export const dynamic = "force-dynamic";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const parsed = taskIdSchema.safeParse(await params);
  if (!parsed.success) notFound();
  let task;
  try {
    task = await getTask(user.id, parsed.data.id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const comments = await listComments(user.id, task.id, { limit: 20 });
  const project = await getProject(user.id, task.projectId);
  const mentionCandidates = await listMentionCandidates(
    task.project.organizationId,
  );
  const membership = await requirePermission(
    user.id,
    task.project.organizationId,
    "organization:read",
  );
  return (
    <article className="overview protected-overview task-detail-page">
      <div className="page-breadcrumbs">
        <a href="/dashboard">Projects</a>
        <span>/</span>
        <a href={`/projects/${task.projectId}`}>{project.name}</a>
        <span>/</span>Issue
      </div>
      <div className="task-detail-layout">
        <div className="task-detail-main">
          <span className="issue-key">
            TASK · {task.id.slice(0, 8).toUpperCase()}
          </span>
          <h1>{task.title}</h1>
          <section className="task-description">
            <h2>Description</h2>
            <p>{task.description ?? "No description has been added yet."}</p>
          </section>
          <TaskComments
            taskId={task.id}
            projectId={task.projectId}
            currentUserId={user.id}
            canManage={hasPermission(membership.role, "projects:manage")}
            initialPage={comments}
            mentionCandidates={mentionCandidates}
          />
        </div>
        <aside className="task-properties">
          <h2>Details</h2>
          <dl>
            <div>
              <dt>Status</dt>
              <dd>
                <span className="status-lozenge">
                  {task.status.replace("_", " ")}
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
                <span className="task-avatar">
                  {task.assignee?.name.slice(0, 1).toUpperCase() ?? "?"}
                </span>
                {task.assignee?.name ?? "Unassigned"}
              </dd>
            </div>
            <div>
              <dt>Project</dt>
              <dd>
                <a href={`/projects/${task.projectId}`}>{project.name}</a>
              </dd>
            </div>
            <div>
              <dt>Due date</dt>
              <dd>
                {task.dueDate
                  ? task.dueDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "UTC",
                    })
                  : "Not set"}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </article>
  );
}
