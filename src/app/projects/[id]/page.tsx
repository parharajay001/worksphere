import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/modules/auth/session";
import { getProject } from "@/modules/projects/project.service";
import { KanbanBoard } from "@/components/kanban-board";
import { getBoard } from "@/modules/tasks/board.service";
import { requirePermission } from "@/modules/authorization/guards";
import { hasPermission } from "@/modules/authorization/permissions";
import { AppError } from "@/lib/api/errors";
import { projectIdSchema } from "@/modules/projects/project.schemas";
import { listActivity } from "@/modules/activity/activity.service";
import { ActivityFeed } from "@/components/activity-feed";
import { ProjectChat } from "@/components/project-chat";
import { ensureConversation, listMessages } from "@/modules/chat/chat.service";
export const dynamic = "force-dynamic";
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const parsed = projectIdSchema.safeParse(await params);
  if (!parsed.success) notFound();
  let project;
  try {
    project = await getProject(user.id, parsed.data.id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const membership = await requirePermission(
    user.id,
    project.organizationId,
    "organization:read",
  );
  const board = await getBoard(user.id, project.id);
  const activity = await listActivity(
    user.id,
    { projectId: project.id },
    { limit: 25 },
  );
  const conversation = await ensureConversation(user.id, {
    projectId: project.id,
  });
  const messages = await listMessages(user.id, conversation.id, { limit: 30 });
  return (
    <article className="overview project-board-page">
      <p className="eyebrow accent">{project.status} project</p>
      <h1>{project.name}</h1>
      <p className="intro">
        {project.description ?? "A focused space for shared progress."}
      </p>
      <p className="quiet-label">
        {project.team ? `Team / ${project.team.name}` : "Organization project"}
      </p>
      <a className="primary-link" href="/dashboard">
        Back to dashboard <span aria-hidden="true">↗</span>
      </a>
      <KanbanBoard
        key={project.id}
        projectId={project.id}
        initialBoard={board}
        canManage={hasPermission(membership.role, "projects:manage")}
      />
      <ActivityFeed
        endpoint={`/api/projects/${project.id}/activity`}
        initialPage={activity}
        title="Project activity"
      />
      <ProjectChat
        projectId={project.id}
        conversationId={conversation.id}
        currentUserId={user.id}
        initialPage={messages}
      />
    </article>
  );
}
