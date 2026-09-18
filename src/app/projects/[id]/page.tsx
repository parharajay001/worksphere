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
import { ConversationChat } from "@/components/conversation-chat";
import { ensureConversation, listMessages } from "@/modules/chat/chat.service";
import Link from "next/link";
import { Settings } from "lucide-react";
import { getOrganizationMembers } from "@/modules/organizations/organization.service";
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
  const canManage = hasPermission(membership.role, "projects:manage");
  const organizationMembers = await getOrganizationMembers(
    user.id,
    project.organizationId,
  );
  const members = canManage
    ? organizationMembers.map(({ user: member }) => member)
    : Array.from(
        new Map(
          board.tasks
            .flatMap((task) => (task.assignee ? [task.assignee] : []))
            .map((member) => [member.id, member]),
        ).values(),
      );
  return (
    <article className="overview project-board-page">
      <div className="page-breadcrumbs">
        <Link href="/dashboard#projects">Projects</Link>
        <span>/</span>
        {project.name}
      </div>
      <header className="project-page-header">
        <div className="project-title-row">
          <span className="project-avatar">
            {project.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="eyebrow accent">{project.status} PROJECT</p>
            <h1>{project.name}</h1>
          </div>
        </div>
        <div className="project-header-actions">
          <span className="status-lozenge">{project.status}</span>
          {hasPermission(membership.role, "projects:manage") && (
            <Link
              className="secondary-button"
              href={`/projects/${project.id}/settings`}
            >
              <Settings size={15} aria-hidden="true" /> Project Settings
            </Link>
          )}
        </div>
      </header>
      <p className="intro project-summary">
        {project.description ?? "A focused space for shared progress."}
      </p>
      <nav className="project-tabs" aria-label="Project views">
        <a className="active" href="#board">
          Board
        </a>
        <a href="#activity">Activity</a>
        <a href="#chat">Chat</a>
      </nav>
      <div id="board">
        <KanbanBoard
          key={project.id}
          projectId={project.id}
          initialBoard={board}
          canManage={canManage}
          members={members}
        />
      </div>
      <div id="activity">
        <ActivityFeed
          endpoint={`/api/projects/${project.id}/activity`}
          initialPage={activity}
          title="Project activity"
        />
      </div>
      <div id="chat">
        <ConversationChat
          scope={{ kind: "project", id: project.id }}
          conversationId={conversation.id}
          currentUserId={user.id}
          participants={organizationMembers.map(({ user: member }) => member)}
          initialPage={messages}
          title="Project chat"
        />
      </div>
    </article>
  );
}
