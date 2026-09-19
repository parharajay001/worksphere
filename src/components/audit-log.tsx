"use client";

import { useState } from "react";
import { LoaderCircle, Search, ShieldCheck } from "lucide-react";

type AuditEvent = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actorId: string | null;
  actorName: string;
  metadata: unknown;
  createdAt: string;
};
type Page = { events: AuditEvent[]; nextCursor: string | null };
type Member = { id: string; name: string };
type Filters = {
  action?: string;
  actorId?: string;
  from?: string;
  to?: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function actionLabel(action: string) {
  return action.replaceAll(".", " ").replaceAll("_", " ");
}

export function AuditLog({
  organizationId,
  initialPage,
  members,
  filters,
}: {
  organizationId: string;
  initialPage: Page;
  members: Member[];
  filters: Filters;
}) {
  const [events, setEvents] = useState(initialPage.events);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const params = new URLSearchParams({ organizationId, limit: "50" });
  for (const [key, value] of Object.entries(filters))
    if (value) params.set(key, value);

  async function loadMore() {
    if (!nextCursor || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/audit?${params}&cursor=${encodeURIComponent(nextCursor)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error();
      const result = (await response.json()) as { data: { events: Page } };
      setEvents((current) => [...current, ...result.data.events.events]);
      setNextCursor(result.data.events.nextCursor);
    } catch {
      setError("More audit events could not be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="audit-stack">
      <form className="audit-filters" method="get" action="/settings/audit">
        <Search size={16} aria-hidden="true" />
        <label>
          <span>Action</span>
          <input
            name="action"
            defaultValue={filters.action ?? ""}
            placeholder="project.created"
            maxLength={80}
          />
        </label>
        <label>
          <span>Actor</span>
          <select name="actorId" defaultValue={filters.actorId ?? ""}>
            <option value="">Anyone</option>
            {members.map((member) => (
              <option value={member.id} key={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>From</span>
          <input type="date" name="from" defaultValue={filters.from ?? ""} />
        </label>
        <label>
          <span>To</span>
          <input type="date" name="to" defaultValue={filters.to ?? ""} />
        </label>
        <button type="submit">Filter events</button>
        {Object.values(filters).some(Boolean) && (
          <a href="/settings/audit">Reset</a>
        )}
      </form>
      <section className="audit-ledger" aria-labelledby="audit-ledger-title">
        <header>
          <div>
            <p className="eyebrow accent">Immutable history</p>
            <h2 id="audit-ledger-title">Workspace events</h2>
          </div>
          <ShieldCheck size={21} />
        </header>
        {error && (
          <p className="settings-error" role="alert">
            {error}
          </p>
        )}
        {events.length ? (
          <div className="audit-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <strong>{actionLabel(event.action)}</strong>
                      <small>{event.id.slice(0, 8)}</small>
                    </td>
                    <td>{event.actorName}</td>
                    <td>
                      <span>{event.targetType}</span>
                      {event.targetId && (
                        <small>{event.targetId.slice(0, 12)}</small>
                      )}
                    </td>
                    <td>
                      <time dateTime={event.createdAt}>
                        {dateFormatter.format(new Date(event.createdAt))}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="audit-empty">
            <ShieldCheck size={24} />
            <h3>No events found</h3>
            <p>Try a wider date range or clear the current filters.</p>
          </div>
        )}
        {nextCursor && (
          <button
            className="audit-load-more"
            type="button"
            disabled={loading}
            onClick={() => void loadMore()}
          >
            {loading ? (
              <>
                <LoaderCircle className="spin" size={14} /> Loading…
              </>
            ) : (
              "Load older events"
            )}
          </button>
        )}
        <p className="audit-status" aria-live="polite">
          {loading ? "Loading older audit events…" : ""}
        </p>
      </section>
    </div>
  );
}
