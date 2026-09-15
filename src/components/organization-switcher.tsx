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
  if (organizations.length === 0)
    return <p className="quiet-label">No organizations yet.</p>;
  async function change(id: string) {
    setPending(true);
    try {
      await fetch("/api/organizations/active", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }
  return (
    <label className="org-switcher">
      Active organization
      <select
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
    </label>
  );
}
