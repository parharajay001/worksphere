"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  CreditCard,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

type Plan = "FREE" | "PRO" | "TEAM";
type Snapshot = {
  plan: Plan;
  entitlements: {
    projects: number | null;
    members: number;
    chatMessagesPerMonth: number;
  };
  subscription: {
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
  } | null;
  usage: { projects: number; members: number; chatMessagesThisMonth: number };
};

const numberFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const plans = [
  {
    id: "FREE" as const,
    label: "Free",
    note: "For focused starts",
    price: "$0",
    projects: "3 projects",
    members: "5 people",
    chat: "500 messages / month",
  },
  {
    id: "PRO" as const,
    label: "Pro",
    note: "For growing teams",
    price: "$18",
    projects: "25 projects",
    members: "50 people",
    chat: "10k messages / month",
  },
  {
    id: "TEAM" as const,
    label: "Team",
    note: "For scaled delivery",
    price: "$42",
    projects: "Unlimited projects",
    members: "500 people",
    chat: "100k messages / month",
  },
];

async function apiError(response: Response) {
  const result = await response.json().catch(() => ({}));
  return result?.error?.message ?? "The billing change could not be completed.";
}

export function BillingManager({
  organizationId,
  organizationName,
  snapshot,
  canManage,
  updated,
}: {
  organizationId: string;
  organizationName: string;
  snapshot: Snapshot;
  canManage: boolean;
  updated: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  async function action(
    kind: "checkout" | "change" | "cancel" | "portal",
    plan?: "PRO" | "TEAM",
  ) {
    setPending(plan ?? kind);
    setError("");
    try {
      const endpoint =
        kind === "checkout"
          ? "/api/billing/checkout"
          : kind === "portal"
            ? "/api/billing/portal"
            : "/api/billing/subscription";
      const response = await fetch(endpoint, {
        method:
          kind === "change" ? "PATCH" : kind === "cancel" ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, ...(plan ? { plan } : {}) }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      const result = await response.json();
      const destination = result.data?.checkoutUrl ?? result.data?.portalUrl;
      if (destination) window.location.assign(destination);
      else router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The billing change could not be completed.",
      );
      setPending("");
    }
  }

  const usage = [
    {
      label: "Active projects",
      value: snapshot.usage.projects,
      limit: snapshot.entitlements.projects,
    },
    {
      label: "Workspace members",
      value: snapshot.usage.members,
      limit: snapshot.entitlements.members,
    },
    {
      label: "Chat messages this month",
      value: snapshot.usage.chatMessagesThisMonth,
      limit: snapshot.entitlements.chatMessagesPerMonth,
    },
  ];

  return (
    <div className="billing-stack">
      {(updated || snapshot.subscription?.cancelAtPeriodEnd) && (
        <div className="billing-notice">
          <Check size={16} />
          {snapshot.subscription?.cancelAtPeriodEnd
            ? `Cancellation scheduled${snapshot.subscription.currentPeriodEnd ? ` for ${dateFormatter.format(new Date(snapshot.subscription.currentPeriodEnd))}` : ""}.`
            : "Billing settings updated."}
        </div>
      )}
      {error && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}
      <section className="billing-hero">
        <div>
          <p className="eyebrow">CURRENT WORKSPACE</p>
          <h1>{organizationName}</h1>
          <p>
            Your <strong>{snapshot.plan.toLowerCase()}</strong> plan is{" "}
            {snapshot.subscription?.status?.toLowerCase() ?? "active"}.
          </p>
        </div>
        <div className="billing-hero-plan">
          <span>{snapshot.plan}</span>
          <strong>
            {snapshot.plan === "FREE"
              ? "$0"
              : snapshot.plan === "PRO"
                ? "$18"
                : "$42"}
          </strong>
          <small>per workspace / month</small>
        </div>
      </section>
      <section className="billing-usage" aria-labelledby="billing-usage-title">
        <div className="billing-section-heading">
          <div>
            <p className="eyebrow accent">Capacity</p>
            <h2 id="billing-usage-title">Usage and limits</h2>
          </div>
          <ShieldCheck size={21} />
        </div>
        <div className="billing-meter-grid">
          {usage.map((item) => {
            const percentage =
              item.limit === null
                ? 0
                : Math.min(100, Math.round((item.value / item.limit) * 100));
            return (
              <article key={item.label}>
                <div>
                  <strong>{item.label}</strong>
                  <span>
                    {numberFormatter.format(item.value)} /{" "}
                    {item.limit === null
                      ? "Unlimited"
                      : numberFormatter.format(item.limit)}
                  </span>
                </div>
                <div
                  className="billing-meter"
                  role="progressbar"
                  aria-label={item.label}
                  aria-valuenow={item.value}
                  aria-valuemax={item.limit ?? undefined}
                >
                  <span
                    style={{
                      width: item.limit === null ? "12%" : `${percentage}%`,
                    }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="billing-plans" aria-labelledby="billing-plans-title">
        <div className="billing-section-heading">
          <div>
            <p className="eyebrow accent">Plans</p>
            <h2 id="billing-plans-title">Choose the room you need</h2>
          </div>
          <CreditCard size={21} />
        </div>
        <div className="billing-plan-grid">
          {plans.map((plan) => {
            const current = plan.id === snapshot.plan;
            return (
              <article
                className={
                  current ? "billing-plan-card current" : "billing-plan-card"
                }
                key={plan.id}
              >
                <div className="billing-plan-top">
                  <div>
                    <span>{plan.label}</span>
                    <small>{plan.note}</small>
                  </div>
                  <strong>
                    {plan.price}
                    <small>/mo</small>
                  </strong>
                </div>
                <ul>
                  <li>{plan.projects}</li>
                  <li>{plan.members}</li>
                  <li>{plan.chat}</li>
                </ul>
                {current ? (
                  <span className="billing-current">
                    <Check size={13} /> Current plan
                  </span>
                ) : plan.id !== "FREE" && canManage ? (
                  <button
                    type="button"
                    disabled={Boolean(pending)}
                    onClick={() =>
                      void action(
                        snapshot.plan === "FREE" ? "checkout" : "change",
                        plan.id,
                      )
                    }
                  >
                    {pending === plan.id ? (
                      <LoaderCircle className="spin" size={15} />
                    ) : (
                      <ArrowUpRight size={15} />
                    )}
                    {snapshot.plan === "FREE"
                      ? `Choose ${plan.label}`
                      : `Switch to ${plan.label}`}
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
      {canManage && snapshot.subscription && (
        <section className="billing-management">
          <div>
            <h2>Subscription controls</h2>
            <p>
              Open the provider portal or schedule cancellation at the end of
              this billing period.
            </p>
          </div>
          <div>
            <button
              className="secondary-button"
              type="button"
              disabled={Boolean(pending)}
              onClick={() => void action("portal")}
            >
              Customer portal
            </button>
            {!snapshot.subscription.cancelAtPeriodEnd && (
              <button
                className="text-danger-button"
                type="button"
                disabled={Boolean(pending)}
                onClick={() => void action("cancel")}
              >
                Cancel plan
              </button>
            )}
          </div>
        </section>
      )}
      {!canManage && (
        <p className="billing-view-only">
          An Owner or Admin can change billing. Everyone can review current
          usage and limits.
        </p>
      )}
    </div>
  );
}
