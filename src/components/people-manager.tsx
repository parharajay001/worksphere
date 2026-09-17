"use client";

import { useState, type FormEvent } from "react";
import {
  Check,
  Clipboard,
  MailPlus,
  RefreshCw,
  Trash2,
  UserMinus,
} from "lucide-react";

type Role = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";
type Member = { role: Role; user: { id: string; name: string; email: string } };
type Invitation = {
  id: string;
  email: string;
  role: Role;
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  expiresAt: string | Date;
  token?: string;
};
const roles: Exclude<Role, "OWNER">[] = [
  "ADMIN",
  "MANAGER",
  "MEMBER",
  "VIEWER",
];
async function errorMessage(response: Response) {
  const body = await response.json().catch(() => ({}));
  return body?.error?.message ?? "The change could not be saved.";
}

export function PeopleManager({
  organizationId,
  currentUserId,
  currentRole,
  canManage,
  initialMembers,
  initialInvitations,
}: {
  organizationId: string;
  currentUserId: string;
  currentRole: Role;
  canManage: boolean;
  initialMembers: Member[];
  initialInvitations: Invitation[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function copyToken(token: string) {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/invitations/accept?token=${encodeURIComponent(token)}`,
      );
      setSuccess("Invitation link copied.");
    } catch {
      setError("Clipboard access was blocked. Resend the invite to try again.");
    }
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending("invite");
    setError("");
    setSuccess("");
    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationId,
        email: data.get("email"),
        role: data.get("role"),
      }),
    });
    if (!response.ok) setError(await errorMessage(response));
    else {
      const { data: result } = await response.json();
      setInvitations((items) => [result.invitation, ...items]);
      form.reset();
      await copyToken(result.invitation.token);
    }
    setPending("");
  }
  async function changeRole(member: Member, role: Exclude<Role, "OWNER">) {
    setPending(member.user.id);
    setError("");
    const response = await fetch(
      `/api/organizations/${organizationId}/members`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: member.user.id, role }),
      },
    );
    if (!response.ok) setError(await errorMessage(response));
    else {
      setMembers((items) =>
        items.map((item) =>
          item.user.id === member.user.id ? { ...item, role } : item,
        ),
      );
      setSuccess(`${member.user.name} is now ${role.toLowerCase()}.`);
    }
    setPending("");
  }
  async function removeMember(member: Member) {
    if (!window.confirm(`Remove ${member.user.name} from this workspace?`))
      return;
    setPending(member.user.id);
    setError("");
    const response = await fetch(
      `/api/organizations/${organizationId}/members`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: member.user.id }),
      },
    );
    if (!response.ok) setError(await errorMessage(response));
    else {
      setMembers((items) =>
        items.filter((item) => item.user.id !== member.user.id),
      );
      setSuccess(`${member.user.name} removed.`);
    }
    setPending("");
  }
  async function resend(invitation: Invitation) {
    setPending(invitation.id);
    setError("");
    const response = await fetch(`/api/invitations/${invitation.id}`, {
      method: "POST",
    });
    if (!response.ok) setError(await errorMessage(response));
    else {
      const { data } = await response.json();
      setInvitations((items) =>
        items.map((item) =>
          item.id === invitation.id ? data.invitation : item,
        ),
      );
      await copyToken(data.invitation.token);
      setSuccess("Invitation resent and fresh link copied.");
    }
    setPending("");
  }
  async function revoke(invitation: Invitation) {
    setPending(invitation.id);
    setError("");
    const response = await fetch(`/api/invitations/${invitation.id}`, {
      method: "DELETE",
    });
    if (!response.ok) setError(await errorMessage(response));
    else {
      setInvitations((items) =>
        items.map((item) =>
          item.id === invitation.id ? { ...item, status: "REVOKED" } : item,
        ),
      );
      setSuccess("Invitation revoked.");
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
        <form className="invite-card" onSubmit={invite}>
          <span className="settings-card-icon">
            <MailPlus aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow accent">GROW THE WORKSPACE</p>
            <h2>Invite someone</h2>
            <p>Send a seven-day invitation with the right starting role.</p>
          </div>
          <label>
            Email address
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="teammate@company.com"
            />
          </label>
          <label>
            Role
            <select name="role" defaultValue="MEMBER">
              {roles
                .filter((role) => currentRole === "OWNER" || role !== "ADMIN")
                .map((role) => (
                  <option key={role}>{role}</option>
                ))}
            </select>
          </label>
          <button className="primary-link" disabled={pending === "invite"}>
            {pending === "invite" ? "Inviting…" : "Create Invite"}
          </button>
        </form>
      )}
      <section className="directory-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ACTIVE DIRECTORY</p>
            <h2>Workspace members</h2>
          </div>
          <span className="outline-label">{members.length} people</span>
        </div>
        <div className="people-table">
          {members.map((member) => {
            const protectedMember =
              member.role === "OWNER" || member.user.id === currentUserId;
            return (
              <div className="people-row" key={member.user.id}>
                <span className="people-avatar">
                  {member.user.name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div>
                  <strong>
                    {member.user.name}
                    {member.user.id === currentUserId && <small> You</small>}
                  </strong>
                  <span>{member.user.email}</span>
                </div>
                <span
                  className={`role-badge role-${member.role.toLowerCase()}`}
                >
                  {member.role}
                </span>
                {canManage && !protectedMember ? (
                  <div className="people-actions">
                    <label>
                      <span className="sr-only">
                        Role for {member.user.name}
                      </span>
                      <select
                        value={member.role}
                        disabled={pending === member.user.id}
                        onChange={(event) =>
                          void changeRole(
                            member,
                            event.target.value as Exclude<Role, "OWNER">,
                          )
                        }
                      >
                        {roles
                          .filter(
                            (role) =>
                              currentRole === "OWNER" || role !== "ADMIN",
                          )
                          .map((role) => (
                            <option key={role}>{role}</option>
                          ))}
                      </select>
                    </label>
                    <button
                      aria-label={`Remove ${member.user.name}`}
                      disabled={pending === member.user.id}
                      onClick={() => void removeMember(member)}
                    >
                      <UserMinus size={16} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <span className="people-protected">
                    {member.role === "OWNER"
                      ? "Protected owner"
                      : "Your account"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <section className="directory-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">INVITATION LOG</p>
            <h2>Pending and past invites</h2>
          </div>
          <span className="outline-label">
            {invitations.filter((item) => item.status === "PENDING").length}{" "}
            pending
          </span>
        </div>
        {invitations.length ? (
          <div className="invitation-list">
            {invitations.map((invitation) => {
              const expired =
                invitation.status === "PENDING" &&
                new Date(invitation.expiresAt) <= new Date();
              return (
                <article key={invitation.id}>
                  <div>
                    <strong>{invitation.email}</strong>
                    <span>
                      {invitation.role.toLowerCase()} ·{" "}
                      {expired ? "Expired" : invitation.status.toLowerCase()}
                    </span>
                  </div>
                  <time dateTime={new Date(invitation.expiresAt).toISOString()}>
                    Expires{" "}
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                    }).format(new Date(invitation.expiresAt))}
                  </time>
                  {canManage && invitation.status === "PENDING" && (
                    <div>
                      {invitation.token && (
                        <button
                          className="secondary-button"
                          onClick={() => void copyToken(invitation.token!)}
                        >
                          <Clipboard size={14} aria-hidden="true" /> Copy link
                        </button>
                      )}
                      <button
                        className="secondary-button"
                        disabled={pending === invitation.id}
                        onClick={() => void resend(invitation)}
                      >
                        <RefreshCw size={14} aria-hidden="true" /> Resend + copy
                      </button>
                      <button
                        className="text-danger-button"
                        disabled={pending === invitation.id}
                        onClick={() => void revoke(invitation)}
                      >
                        <Trash2 size={14} aria-hidden="true" /> Revoke
                      </button>
                    </div>
                  )}
                  {!canManage && (
                    <span className="role-badge">{invitation.status}</span>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="dashboard-empty-state">
            <span aria-hidden="true">
              <Clipboard />
            </span>
            <div>
              <h3>No invitations yet.</h3>
              <p>Invitations and their status will appear here.</p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
