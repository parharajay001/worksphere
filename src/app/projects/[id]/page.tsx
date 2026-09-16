import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/modules/auth/session";
import { getProject } from "@/modules/projects/project.service";
import { KanbanBoard } from "@/components/kanban-board";
import { getBoard } from "@/modules/tasks/board.service";
import { requirePermission } from "@/modules/authorization/guards";
import { hasPermission } from "@/modules/authorization/permissions";
import { AppError } from "@/lib/api/errors";
import { taskIdSchema } from "@/modules/tasks/task.schemas";
export const dynamic = "force-dynamic";
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const parsed = taskIdSchema.safeParse(await params);
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
    </article>
  );
}
