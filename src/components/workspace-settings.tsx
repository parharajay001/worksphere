"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AlertTriangle, Building2, Check, Plus, Trash2 } from "lucide-react";

type Organization = { id: string; name: string; slug: string };
type Membership = { role: string; organization: Organization };
type ApiError = {
  error?: { message?: string; details?: Array<{ message: string }> };
};

async function responseError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as ApiError;
  return (
    body.error?.details?.[0]?.message ?? body.error?.message ?? "Try again."
  );
}

export function WorkspaceSettings({
  memberships: initialMemberships,
  activeId,
  startCreating,
}: {
  memberships: Membership[];
  activeId?: string;
  startCreating: boolean;
}) {
  const router = useRouter();
  const [memberships, setMemberships] = useState(initialMemberships);
  const initialActive =
    memberships.find((item) => item.organization.id === activeId) ??
    memberships[0];
  const [selectedId, setSelectedId] = useState(
    initialActive?.organization.id ?? "",
  );
  const selected = memberships.find(
    (item) => item.organization.id === selectedId,
  );
  const [creating, setCreating] = useState(startCreating || !selected);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteValue, setDeleteValue] = useState("");
  const canUpdate = selected?.role === "OWNER" || selected?.role === "ADMIN";
  const canDelete = selected?.role === "OWNER";

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      ...(form.get("slug") ? { slug: String(form.get("slug")) } : {}),
    };
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const result = (await response.json()) as {
        data: { organization: Organization & { role: string } };
      };
      const organization = result.data.organization;
      const activeResponse = await fetch("/api/organizations/active", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: organization.id }),
      });
      if (!activeResponse.ok)
        throw new Error(await responseError(activeResponse));
      setMemberships((current) => [
        ...current,
        { role: organization.role, organization },
      ]);
      setSelectedId(organization.id);
      setCreating(false);
      setSuccess(`${organization.name} is ready.`);
      window.dispatchEvent(new Event("worksphere:organizations-changed"));
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Workspace could not be created.",
      );
    } finally {
      setPending(false);
    }
  }

  async function updateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setPending(true);
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(
        `/api/organizations/${selected.organization.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: String(form.get("name") ?? ""),
            slug: String(form.get("slug") ?? ""),
          }),
        },
      );
      if (!response.ok) throw new Error(await responseError(response));
      const result = (await response.json()) as {
        data: { organization: Organization };
      };
      setMemberships((current) =>
        current.map((item) =>
          item.organization.id === result.data.organization.id
            ? { ...item, organization: result.data.organization }
            : item,
        ),
      );
      setSuccess("Workspace settings saved.");
      window.dispatchEvent(new Event("worksphere:organizations-changed"));
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Settings could not be saved.",
      );
    } finally {
      setPending(false);
    }
  }

  async function deleteWorkspace() {
    if (!selected || deleteValue !== selected.organization.name) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/organizations/${selected.organization.id}`,
        {
          method: "DELETE",
        },
      );
      if (!response.ok) throw new Error(await responseError(response));
      const remaining = memberships.filter(
        (item) => item.organization.id !== selected.organization.id,
      );
      setMemberships(remaining);
      setSelectedId(remaining[0]?.organization.id ?? "");
      setDeleteValue("");
      if (remaining[0]) {
        const activeResponse = await fetch("/api/organizations/active", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: remaining[0].organization.id }),
        });
        if (!activeResponse.ok)
          throw new Error(await responseError(activeResponse));
      } else setCreating(true);
      window.dispatchEvent(new Event("worksphere:organizations-changed"));
      router.push(remaining.length ? "/settings/workspace" : "/dashboard");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Workspace could not be deleted.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="workspace-settings-layout">
      <aside className="workspace-settings-rail" aria-label="Workspace list">
        <p className="settings-kicker">Workspaces</p>
        {memberships.map((item) => (
          <button
            type="button"
            key={item.organization.id}
            className={
              item.organization.id === selectedId && !creating ? "active" : ""
            }
            onClick={() => {
              setSelectedId(item.organization.id);
              setCreating(false);
              setError("");
              setSuccess("");
            }}
          >
            <span aria-hidden="true">{item.organization.name.slice(0, 1)}</span>
            <span>
              <strong>{item.organization.name}</strong>
              <small>{item.role.toLowerCase()}</small>
            </span>
          </button>
        ))}
        <button
          type="button"
          className="create-workspace-rail"
          onClick={() => setCreating(true)}
        >
          <Plus size={16} aria-hidden="true" /> New Workspace
        </button>
      </aside>

      <div className="workspace-settings-content">
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
        {creating ? (
          <section
            className="settings-card"
            aria-labelledby="create-workspace-title"
          >
            <span className="settings-card-icon">
              <Building2 aria-hidden="true" />
            </span>
            <p className="eyebrow accent">A new shared space</p>
            <h2 id="create-workspace-title">Create a workspace</h2>
            <p className="settings-lede">
              Give your team a clear home. You can invite people and add
              projects next.
            </p>
            <form className="settings-form" onSubmit={createWorkspace}>
              <label>
                Workspace name
                <input
                  name="name"
                  required
                  maxLength={100}
                  autoComplete="organization"
                  placeholder="Acme Product Team"
                />
              </label>
              <label>
                Workspace URL slug <span>Optional</span>
                <input
                  name="slug"
                  maxLength={63}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="acme-product"
                />
                <small>Lowercase letters, numbers, and hyphens.</small>
              </label>
              <div className="settings-actions">
                {memberships.length > 0 && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setCreating(false)}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="primary-link"
                  disabled={pending}
                >
                  {pending ? "Creating…" : "Create Workspace"}
                </button>
              </div>
            </form>
          </section>
        ) : selected ? (
          <>
            <section
              key={selected.organization.id}
              className="settings-card"
              aria-labelledby="workspace-profile-title"
            >
              <p className="eyebrow accent">Workspace profile</p>
              <h2 id="workspace-profile-title">General settings</h2>
              <p className="settings-lede">
                The name appears across projects, activity, and invitations.
              </p>
              <form className="settings-form" onSubmit={updateWorkspace}>
                <label>
                  Workspace name
                  <input
                    name="name"
                    required
                    maxLength={100}
                    defaultValue={selected.organization.name}
                    disabled={!canUpdate || pending}
                    autoComplete="organization"
                  />
                </label>
                <label>
                  Workspace URL slug
                  <input
                    name="slug"
                    required
                    maxLength={63}
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    defaultValue={selected.organization.slug}
                    disabled={!canUpdate || pending}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <small>Lowercase letters, numbers, and hyphens.</small>
                </label>
                <div className="settings-role-note">
                  Your role: <strong>{selected.role.toLowerCase()}</strong>
                </div>
                {canUpdate && (
                  <div className="settings-actions">
                    <button
                      type="submit"
                      className="primary-link"
                      disabled={pending}
                    >
                      {pending ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                )}
                {!canUpdate && (
                  <p className="settings-muted">
                    Only workspace owners and admins can change these settings.
                  </p>
                )}
              </form>
            </section>
            {canDelete && (
              <section
                className="settings-card danger-zone"
                aria-labelledby="danger-zone-title"
              >
                <AlertTriangle size={22} aria-hidden="true" />
                <div>
                  <h2 id="danger-zone-title">Delete workspace</h2>
                  <p>
                    Projects, tasks, comments, and workspace history will be
                    permanently deleted.
                  </p>
                  <label>
                    Type <strong>{selected.organization.name}</strong> to
                    confirm
                    <input
                      value={deleteValue}
                      onChange={(event) => setDeleteValue(event.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <button
                    type="button"
                    className="danger-button"
                    disabled={
                      pending || deleteValue !== selected.organization.name
                    }
                    onClick={() => void deleteWorkspace()}
                  >
                    <Trash2 size={15} aria-hidden="true" /> Delete Workspace
                  </button>
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
