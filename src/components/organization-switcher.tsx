"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
type Organization = { id: string; name: string; slug: string };
export function OrganizationSwitcher({
  organizations,
  activeId,
}: {
  organizations: Organization[];
  activeId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (organizations.length === 0)
    return <p className="quiet-label">No organizations yet.</p>;
  async function change(id: string) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/organizations/active", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Organization could not be switched. Try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <label className="org-switcher">
      Active organization
      <select
        name="activeOrganizationId"
        value={activeId ?? organizations[0]?.id}
        disabled={pending}
        onChange={(event) => void change(event.target.value)}
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      <span className="org-switcher-status" role="status" aria-live="polite">
        {pending ? "Switching organization…" : error}
      </span>
    </label>
  );
}
