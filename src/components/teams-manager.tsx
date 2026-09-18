"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Check,
  Pencil,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  MessageCircle,
} from "lucide-react";

type Person = { id: string; name: string; email: string };
type Member = { role: string; user: Person };
type TeamMember = { userId: string; user: Person };
type Team = {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  memberships: TeamMember[];
  _count: { projects: number };
};

async function message(response: Response) {
  const body = await response.json().catch(() => ({}));
  return body?.error?.message ?? "The change could not be saved.";
}

export function TeamsManager({
  organizationId,
  canManage,
  members,
  initialTeams,
  currentUserId,
}: {
  organizationId: string;
  canManage: boolean;
  members: Member[];
  initialTeams: Team[];
  currentUserId: string;
}) {
  const [teams, setTeams] = useState(initialTeams);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "");
    setPending("create");
    setError("");
    setSuccess("");
    const response = await fetch("/api/teams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId, name }),
    });
    if (!response.ok) setError(await message(response));
    else {
      const { data } = await response.json();
      setTeams((current) =>
        [
          ...current,
          { ...data.team, memberships: [], _count: { projects: 0 } },
        ].sort((a, b) => a.name.localeCompare(b.name)),
      );
      form.reset();
      setSuccess(`${name} created.`);
    }
    setPending("");
  }

  async function rename(team: Team, form: FormData) {
    const name = String(form.get("name") ?? "");
    setPending(team.id);
    setError("");
    const response = await fetch(`/api/teams/${team.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) setError(await message(response));
    else {
      const { data } = await response.json();
      setTeams((current) =>
        current.map((item) =>
          item.id === team.id ? { ...item, ...data.team } : item,
        ),
      );
      setSuccess("Team renamed.");
    }
    setPending("");
  }

  async function addMember(team: Team, userId: string) {
    if (!userId) return;
    setPending(team.id);
    setError("");
    const response = await fetch(`/api/teams/${team.id}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) setError(await message(response));
    else {
      const person = members.find((item) => item.user.id === userId)!.user;
      setTeams((current) =>
        current.map((item) =>
          item.id === team.id
            ? {
                ...item,
                memberships: [...item.memberships, { userId, user: person }],
              }
            : item,
        ),
      );
      setSuccess(`${person.name} added to ${team.name}.`);
    }
    setPending("");
  }

  async function removeMember(team: Team, member: TeamMember) {
    setPending(team.id);
    setError("");
    const response = await fetch(
      `/api/teams/${team.id}/members/${member.userId}`,
      { method: "DELETE" },
    );
    if (!response.ok) setError(await message(response));
    else {
      setTeams((current) =>
        current.map((item) =>
          item.id === team.id
            ? {
                ...item,
                memberships: item.memberships.filter(
                  (entry) => entry.userId !== member.userId,
                ),
              }
            : item,
        ),
      );
      setSuccess(`${member.user.name} removed from ${team.name}.`);
    }
    setPending("");
  }

  async function removeTeam(team: Team) {
    if (
      !window.confirm(
        `Delete ${team.name}? Projects will remain but no longer belong to this team.`,
      )
    )
      return;
    setPending(team.id);
    setError("");
    const response = await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
    if (!response.ok) setError(await message(response));
    else {
      setTeams((current) => current.filter((item) => item.id !== team.id));
      setSuccess(`${team.name} deleted.`);
    }
    setPending("");
  }

  return (
    <>
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
      {canManage && (
        <form className="team-create-strip" onSubmit={create}>
          <div>
            <span className="settings-card-icon">
              <Users aria-hidden="true" />
            </span>
            <div>
              <strong>Create a team</strong>
              <small>Group people around a discipline or outcome.</small>
            </div>
          </div>
          <label>
            <span className="sr-only">Team name</span>
            <input
              name="name"
              required
              maxLength={100}
              placeholder="Design, Growth, Platform…"
            />
          </label>
          <button className="primary-link" disabled={pending === "create"}>
            {pending === "create" ? "Creating…" : "Create Team"}
          </button>
        </form>
      )}
      {teams.length ? (
        <div className="team-grid">
          {teams.map((team) => {
            const available = members.filter(
              (member) =>
                !team.memberships.some(
                  (item) => item.userId === member.user.id,
                ),
            );
            return (
              <article className="team-card" key={team.id}>
                <header>
                  <div className="team-monogram">
                    {team.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="eyebrow accent">
                      {team._count.projects}{" "}
                      {team._count.projects === 1 ? "project" : "projects"}
                    </p>
                    <h2>{team.name}</h2>
                    <small>
                      {team.memberships.length}{" "}
                      {team.memberships.length === 1 ? "member" : "members"}
                    </small>
                  </div>
                </header>
                <div className="team-member-stack">
                  {team.memberships.length ? (
                    team.memberships.map((member) => (
                      <div key={member.userId}>
                        <span>{member.user.name.slice(0, 1)}</span>
                        <div>
                          <strong>{member.user.name}</strong>
                          <small>{member.user.email}</small>
                        </div>
                        {canManage && (
                          <button
                            aria-label={`Remove ${member.user.name} from ${team.name}`}
                            disabled={pending === team.id}
                            onClick={() => void removeMember(team, member)}
                          >
                            <UserMinus size={15} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p>No one has joined this team yet.</p>
                  )}
                </div>
                {(canManage ||
                  team.memberships.some(
                    (member) => member.userId === currentUserId,
                  )) && (
                  <Link className="team-chat-link" href={`/teams/${team.id}`}>
                    <MessageCircle size={15} aria-hidden="true" /> Open team
                    chat
                  </Link>
                )}
                {canManage && (
                  <div className="team-controls">
                    {available.length > 0 && (
                      <label>
                        <span>Add member</span>
                        <select
                          aria-label={`Add member to ${team.name}`}
                          defaultValue=""
                          onChange={(event) => {
                            void addMember(team, event.target.value);
                            event.target.value = "";
                          }}
                        >
                          <option value="">Choose a person…</option>
                          {available.map((member) => (
                            <option key={member.user.id} value={member.user.id}>
                              {member.user.name}
                            </option>
                          ))}
                        </select>
                        <UserPlus size={15} aria-hidden="true" />
                      </label>
                    )}
                    <form action={(form) => void rename(team, form)}>
                      <label>
                        <span>Team name</span>
                        <input name="name" defaultValue={team.name} required />
                      </label>
                      <button
                        className="secondary-button"
                        disabled={pending === team.id}
                      >
                        <Pencil size={14} aria-hidden="true" /> Rename
                      </button>
                    </form>
                    <button
                      className="text-danger-button"
                      disabled={pending === team.id}
                      onClick={() => void removeTeam(team)}
                    >
                      <Trash2 size={14} aria-hidden="true" /> Delete team
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="dashboard-empty-state">
          <span aria-hidden="true">TM</span>
          <div>
            <h3>No teams yet.</h3>
            <p>Create a team to give people and projects a shared home.</p>
          </div>
        </div>
      )}
    </>
  );
}
