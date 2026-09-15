import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/modules/auth/session";
import { getTask } from "@/modules/tasks/task.service";
export const dynamic = "force-dynamic";
export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  let task;
  try {
    task = await getTask(user.id, (await params).id);
  } catch {
    notFound();
  }
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
    </article>
  );
}
