"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Archive,
  Check,
  FolderKanban,
  RotateCcw,
  Trash2,
  UserPlus,
} from "lucide-react";

type Person = { id: string; name: string; email: string };
type OrganizationMember = { role: string; user: Person };
type Team = { id: string; name: string };
type Project = {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  teamId: string | null;
  ownerId: string;
};
type ProjectMember = { userId: string; user: Person };
type ApiError = {
  error?: { message?: string; details?: Array<{ message: string }> };
};

async function responseError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as ApiError;
  if (response.status === 409)
    return "A project with this name already exists. Choose another name.";
  if (response.status === 403)
    return "Your role does not allow this project change.";
  return (
    body.error?.details?.[0]?.message ??
    body.error?.message ??
    "The project could not be saved. Try again."
  );
}

export function ProjectForm({
  organizationId,
  organizationName,
  teams,
  members,
  project,
  initialProjectMembers = [],
}: {
  organizationId: string;
  organizationName: string;
  teams: Team[];
  members: OrganizationMember[];
  project?: Project;
  initialProjectMembers?: ProjectMember[];
}) {
  const router = useRouter();
  const editing = Boolean(project);
  const [projectMembers, setProjectMembers] = useState(initialProjectMembers);
  const [pending, setPending] = useState(false);
  const [memberPending, setMemberPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteValue, setDeleteValue] = useState("");
  const [selectedMember, setSelectedMember] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    const payload = {
      ...(editing ? {} : { organizationId }),
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      status: String(form.get("status")) as "ACTIVE" | "ARCHIVED",
      teamId: form.get("teamId") ? String(form.get("teamId")) : null,
      ownerId: String(form.get("ownerId")),
    };
    try {
      const response = await fetch(
        editing ? `/api/projects/${project!.id}` : "/api/projects",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw new Error(await responseError(response));
      const result = (await response.json()) as {
        data: { project: Project };
      };
      if (!editing) {
        router.push(`/projects/${result.data.project.id}`);
        return;
      }
      setSuccess("Project settings saved.");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The project could not be saved.",
      );
    } finally {
      setPending(false);
    }
  }

  async function changeStatus(status: "ACTIVE" | "ARCHIVED") {
    if (!project) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      setSuccess(
        status === "ARCHIVED" ? "Project archived." : "Project reactivated.",
      );
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Status could not be changed.",
      );
    } finally {
      setPending(false);
    }
  }

  async function addMember() {
    if (!project || !selectedMember) return;
    setMemberPending(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: selectedMember }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const person = members.find(
        (item) => item.user.id === selectedMember,
      )?.user;
      if (person)
        setProjectMembers((current) => [
          ...current,
          { userId: person.id, user: person },
        ]);
      setSelectedMember("");
      setSuccess("Project member added.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Member could not be added.",
      );
    } finally {
      setMemberPending(false);
    }
  }

  async function deleteProject() {
    if (!project || deleteValue !== project.name) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await responseError(response));
      router.push("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Project could not be deleted.",
      );
      setPending(false);
    }
  }

  const availableMembers = members.filter(
    (item) =>
      item.user.id !== project?.ownerId &&
      !projectMembers.some((member) => member.userId === item.user.id),
  );

  return (
    <div className="project-settings-stack">
      <div className="settings-status" aria-live="polite">
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
      <section
        className="settings-card project-form-card"
        aria-labelledby="project-form-title"
      >
        <span className="settings-card-icon">
          <FolderKanban aria-hidden="true" />
        </span>
        <p className="eyebrow accent">
          {editing ? "Project profile" : organizationName}
        </p>
        <h1 id="project-form-title">
          {editing ? "Project settings" : "Create a new project"}
        </h1>
        <p className="settings-lede">
          {editing
            ? "Keep ownership, scope, and project status accurate."
            : "Give the work a name, a clear owner, and a place on the team."}
        </p>
        <form className="settings-form" onSubmit={submit}>
          <label>
            Project name
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={project?.name}
              autoComplete="off"
              placeholder="Website launch"
            />
          </label>
          <label>
            Description <span>Optional</span>
            <textarea
              name="description"
              maxLength={1000}
              defaultValue={project?.description ?? ""}
              placeholder="What is this project trying to accomplish?"
            />
          </label>
          <div className="project-form-grid">
            <label>
              Team
              <select name="teamId" defaultValue={project?.teamId ?? ""}>
                <option value="">No team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Owner
              <select
                name="ownerId"
                required
                defaultValue={project?.ownerId ?? members[0]?.user.id}
              >
                {members.map((member) => (
                  <option key={member.user.id} value={member.user.id}>
                    {member.user.name} · {member.role.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select name="status" defaultValue={project?.status ?? "ACTIVE"}>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
          </div>
          <div className="settings-actions">
            <Link
              className="secondary-button"
              href={editing ? `/projects/${project!.id}` : "/dashboard"}
            >
              Cancel
            </Link>
            <button type="submit" className="primary-link" disabled={pending}>
              {pending
                ? "Saving…"
                : editing
                  ? "Save Project"
                  : "Create Project"}
            </button>
          </div>
        </form>
      </section>

      {project && (
        <section
          className="settings-card project-members-card"
          aria-labelledby="project-members-title"
        >
          <p className="eyebrow accent">Access</p>
          <h2 id="project-members-title">Project members</h2>
          <p className="settings-lede">
            Add workspace members who are directly involved in this project.
          </p>
          <div className="project-member-list">
            <div>
              <span>
                {members
                  .find((item) => item.user.id === project.ownerId)
                  ?.user.name.slice(0, 1) ?? "O"}
              </span>
              <div>
                <strong>
                  {members.find((item) => item.user.id === project.ownerId)
                    ?.user.name ?? "Project owner"}
                </strong>
                <small>Owner</small>
              </div>
            </div>
            {projectMembers.map((member) => (
              <div key={member.userId}>
                <span>{member.user.name.slice(0, 1)}</span>
                <div>
                  <strong>{member.user.name}</strong>
                  <small>{member.user.email}</small>
                </div>
              </div>
            ))}
          </div>
          {availableMembers.length > 0 ? (
            <div className="project-member-add">
              <label htmlFor="project-member">Add a workspace member</label>
              <div>
                <select
                  id="project-member"
                  value={selectedMember}
                  onChange={(event) => setSelectedMember(event.target.value)}
                >
                  <option value="">Choose a person…</option>
                  {availableMembers.map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {member.user.name} · {member.user.email}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!selectedMember || memberPending}
                  onClick={() => void addMember()}
                >
                  <UserPlus size={15} aria-hidden="true" />
                  {memberPending ? "Adding…" : "Add Member"}
                </button>
              </div>
            </div>
          ) : (
            <p className="settings-muted">
              All available workspace members are already on this project.
            </p>
          )}
        </section>
      )}

      {project && (
        <section
          className="settings-card danger-zone project-lifecycle"
          aria-labelledby="project-lifecycle-title"
        >
          <AlertTriangle size={22} aria-hidden="true" />
          <div>
            <h2 id="project-lifecycle-title">Project lifecycle</h2>
            <p>
              Archived projects remain available for reference. Deletion
              permanently removes their tasks and history.
            </p>
            <div className="project-lifecycle-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={pending}
                onClick={() =>
                  void changeStatus(
                    project.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE",
                  )
                }
              >
                {project.status === "ACTIVE" ? (
                  <Archive size={15} aria-hidden="true" />
                ) : (
                  <RotateCcw size={15} aria-hidden="true" />
                )}
                {project.status === "ACTIVE"
                  ? "Archive Project"
                  : "Reactivate Project"}
              </button>
            </div>
            <label>
              Type <strong>{project.name}</strong> to permanently delete
              <input
                value={deleteValue}
                onChange={(event) => setDeleteValue(event.target.value)}
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              className="danger-button"
              disabled={pending || deleteValue !== project.name}
              onClick={() => void deleteProject()}
            >
              <Trash2 size={15} aria-hidden="true" /> Delete Project
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
