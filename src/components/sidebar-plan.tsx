"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function SidebarPlan() {
  const [plan, setPlan] = useState<string>("");
  const [projects, setProjects] = useState<{
    value: number;
    limit: number | null;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const reload = () => setRevision((value) => value + 1);
    window.addEventListener("worksphere:active-organization-changed", reload);
    window.addEventListener("worksphere:organizations-changed", reload);
    return () => {
      window.removeEventListener(
        "worksphere:active-organization-changed",
        reload,
      );
      window.removeEventListener("worksphere:organizations-changed", reload);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const active = await fetch("/api/organizations/active", {
        cache: "no-store",
      });
      if (!active.ok) return;
      const activeResult = await active.json();
      const organizationId = activeResult.data.organization?.id;
      if (!organizationId) return;
      const response = await fetch(
        `/api/billing?organizationId=${encodeURIComponent(organizationId)}`,
        { cache: "no-store" },
      );
      if (!response.ok || cancelled) return;
      const result = await response.json();
      if (!cancelled) {
        setPlan(result.data.billing.plan);
        setProjects({
          value: result.data.billing.usage.projects,
          limit: result.data.billing.entitlements.projects,
        });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [revision]);
  return (
    <Link className="sidebar-upgrade" href="/settings/billing">
      <span>{plan ? `${plan} PLAN` : "PLAN & USAGE"}</span>
      <strong>
        {projects
          ? `${projects.value} of ${projects.limit ?? "∞"} projects`
          : "View workspace capacity"}
      </strong>
      <p>
        {plan === "FREE"
          ? "Upgrade when your team needs more room."
          : "Manage plan and billing."}
      </p>
    </Link>
  );
}
