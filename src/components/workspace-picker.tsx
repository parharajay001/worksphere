"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronsUpDown, Plus, Settings } from "lucide-react";

type Organization = { id: string; name: string; slug: string };
type Membership = { role: string; organization: Organization };
type ApiError = { error?: { message?: string } };

export function WorkspacePicker() {
  const pathname = usePathname();
  const router = useRouter();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeId, setActiveId] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const reload = () => setRevision((value) => value + 1);
    window.addEventListener("worksphere:organizations-changed", reload);
    return () =>
      window.removeEventListener("worksphere:organizations-changed", reload);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [organizationsResponse, activeResponse] = await Promise.all([
          fetch("/api/organizations", { cache: "no-store" }),
          fetch("/api/organizations/active", { cache: "no-store" }),
        ]);
        if (!organizationsResponse.ok || !activeResponse.ok) throw new Error();
        const organizationsResult = (await organizationsResponse.json()) as {
          data: { organizations: Membership[] };
        };
        const activeResult = (await activeResponse.json()) as {
          data: { organization: Organization | null };
        };
        if (!cancelled) {
          setMemberships(organizationsResult.data.organizations);
          setActiveId(activeResult.data.organization?.id ?? "");
        }
      } catch {
        if (!cancelled) setError("Workspaces could not be loaded.");
      } finally {
        if (!cancelled) setPending(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [pathname, revision]);

  const active =
    memberships.find((item) => item.organization.id === activeId)
      ?.organization ?? memberships[0]?.organization;

  async function switchWorkspace(id: string) {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/organizations/active", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const body = (await response.json()) as ApiError;
        throw new Error(body.error?.message);
      }
      setActiveId(id);
      setOpen(false);
      window.dispatchEvent(new Event("worksphere:active-organization-changed"));
      router.push("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Workspace could not be switched. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="workspace-menu">
      <button
        className="workspace-picker"
        type="button"
        aria-label="Choose workspace"
        aria-expanded={open}
        aria-controls="workspace-menu-panel"
        onClick={() => setOpen((value) => !value)}
        disabled={pending}
      >
        <span className="workspace-monogram" aria-hidden="true">
          {active?.name.slice(0, 2).toUpperCase() ?? "WS"}
        </span>
        <span>
          {pending ? "Loading…" : (active?.name ?? "Create workspace")}
        </span>
        <ChevronsUpDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="workspace-menu-panel" id="workspace-menu-panel">
          <p className="workspace-menu-label">Your workspaces</p>
          {memberships.map(({ organization }) => (
            <button
              type="button"
              className={organization.id === active?.id ? "is-active" : ""}
              key={organization.id}
              onClick={() => void switchWorkspace(organization.id)}
            >
              <span className="workspace-menu-avatar" aria-hidden="true">
                {organization.name.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong>{organization.name}</strong>
                <small>{organization.slug}</small>
              </span>
              {organization.id === active?.id && (
                <span aria-hidden="true">✓</span>
              )}
            </button>
          ))}
          {memberships.length === 0 && (
            <p className="workspace-menu-empty">No workspace yet.</p>
          )}
          <div className="workspace-menu-links">
            <Link
              href="/settings/workspace?create=1"
              onClick={() => setOpen(false)}
            >
              <Plus size={15} aria-hidden="true" /> Create Workspace
            </Link>
            {active && (
              <Link href="/settings/workspace" onClick={() => setOpen(false)}>
                <Settings size={15} aria-hidden="true" /> Workspace Settings
              </Link>
            )}
          </div>
        </div>
      )}
      <p className="workspace-picker-status" aria-live="polite">
        {error}
      </p>
    </div>
  );
}
