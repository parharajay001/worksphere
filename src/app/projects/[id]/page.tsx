import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/modules/auth/session";
import { getProject } from "@/modules/projects/project.service";
export const dynamic = "force-dynamic";
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  let project;
  try {
    project = await getProject(user.id, (await params).id);
  } catch {
    notFound();
  }
  return (
    <article className="overview protected-overview">
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
    </article>
  );
}
