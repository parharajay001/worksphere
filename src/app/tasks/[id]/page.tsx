import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TaskComments } from "@/components/task-comments";
import { TaskEditor } from "@/components/task-editor";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { requirePermission } from "@/modules/authorization/guards";
import { hasPermission } from "@/modules/authorization/permissions";
import { listComments } from "@/modules/comments/comment.service";
import { listMentionCandidates } from "@/modules/comments/mentions";
import { getOrganizationMembers } from "@/modules/organizations/organization.service";
import { getProject } from "@/modules/projects/project.service";
import { getTask } from "@/modules/tasks/task.service";
import { taskIdSchema } from "@/modules/tasks/task.schemas";

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
  const [comments, project, mentionCandidates, membership] = await Promise.all([
    listComments(user.id, task.id, { limit: 20 }),
    getProject(user.id, task.projectId),
    listMentionCandidates(task.project.organizationId),
    requirePermission(
      user.id,
      task.project.organizationId,
      "organization:read",
    ),
  ]);
  const canManage = hasPermission(membership.role, "projects:manage");
  const members = canManage
    ? (await getOrganizationMembers(user.id, task.project.organizationId)).map(
        ({ user: member }) => member,
      )
    : task.assignee
      ? [task.assignee]
      : [];

  return (
    <article className="overview protected-overview task-detail-page">
      <div className="page-breadcrumbs">
        <Link href="/dashboard">Projects</Link>
        <span>/</span>
        <Link href={`/projects/${task.projectId}`}>{project.name}</Link>
        <span>/</span>Task
      </div>
      <TaskEditor
        initialTask={{
          ...task,
          dueDate: task.dueDate?.toISOString() ?? null,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
        }}
        members={members}
        projectName={project.name}
        canManage={canManage}
      />
      <div className="task-comments-width">
        <TaskComments
          taskId={task.id}
          projectId={task.projectId}
          currentUserId={user.id}
          canManage={canManage}
          initialPage={comments}
          mentionCandidates={mentionCandidates}
        />
      </div>
    </article>
  );
}
