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
  const mentionCandidates = await listMentionCandidates(
    task.project.organizationId,
  );
  const membership = await requirePermission(
    user.id,
    task.project.organizationId,
    "organization:read",
  );
  return (
    <article className="overview protected-overview">
      <p className="eyebrow accent">
        {task.priority} / {task.status}
      </p>
      <h1>{task.title}</h1>
      <p className="intro">{task.description ?? "No description yet."}</p>
      <p className="quiet-label">
        {task.assignee ? `Assigned to ${task.assignee.name}` : "Unassigned"}
      </p>
      <a className="primary-link" href={`/projects/${task.projectId}`}>
        Back to project <span aria-hidden="true">↗</span>
      </a>
      <TaskComments
        taskId={task.id}
        projectId={task.projectId}
        currentUserId={user.id}
        canManage={hasPermission(membership.role, "projects:manage")}
        initialPage={comments}
        mentionCandidates={mentionCandidates}
      />
    </article>
  );
}
