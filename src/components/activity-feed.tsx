"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AtSign,
  CheckCircle2,
  FolderKanban,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  UserCheck,
} from "lucide-react";

export type ActivityItem = {
  id: string;
  action: string;
  metadata: Record<string, string | number>;
  createdAt: string;
  actor: { id: string; name: string };
  project: { id: string; name: string };
};
type Page = { activities: ActivityItem[]; nextCursor: string | null };

const actionCopy: Record<string, { label: string; icon: typeof Activity }> = {
  "task.created": { label: "created a task", icon: Plus },
  "task.updated": { label: "updated a task", icon: Pencil },
  "task.moved": { label: "moved a task", icon: CheckCircle2 },
  "comment.created": { label: "commented", icon: MessageCircle },
  "comment.updated": { label: "edited a comment", icon: Pencil },
  "comment.deleted": { label: "deleted a comment", icon: Trash2 },
  "mention.created": { label: "mentioned a teammate", icon: AtSign },
  "project.created": { label: "created a project", icon: FolderKanban },
  "project.updated": { label: "updated a project", icon: Pencil },
  "member.invited": { label: "invited a member", icon: UserPlus },
  "task.assigned": { label: "assigned a task", icon: UserCheck },
  "task.status_changed": { label: "changed task status", icon: CheckCircle2 },
};

function relativeDate(value: string) {
  const age = Date.now() - new Date(value).getTime();
  if (age < 60_000) return "just now";
  if (age < 3_600_000) return `${Math.floor(age / 60_000)}m ago`;
  if (age < 86_400_000) return `${Math.floor(age / 3_600_000)}h ago`;
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function copyFor(action: string) {
  return (
    actionCopy[action] ?? {
      label: action.replaceAll(".", " "),
      icon: Activity,
    }
  );
}

export function ActivityFeed({
  endpoint,
  initialPage,
  title,
}: {
  endpoint: string;
  initialPage: Page;
  title: string;
}) {
  const [activities, setActivities] = useState(initialPage.activities);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function loadMore() {
    if (!nextCursor || loading) return;
    setLoading(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch(
        `${endpoint}?limit=25&cursor=${encodeURIComponent(nextCursor)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error();
      const result = (await response.json()) as { data: Page };
      setActivities((current) => [...current, ...result.data.activities]);
      setNextCursor(result.data.nextCursor);
      setStatus("Older activity loaded.");
    } catch {
      setError("Activity could not be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="activity-feed" aria-labelledby={`${endpoint}-title`}>
      <div className="activity-feed-heading">
        <div>
          <p className="eyebrow accent">A clear trail</p>
          <h2 id={`${endpoint}-title`}>{title}</h2>
        </div>
        <Activity size={20} aria-hidden="true" />
      </div>
      {error && (
        <p className="comments-error" role="alert">
          {error}
        </p>
      )}
      <div className="activity-list">
        {activities.map((item) => {
          const copy = copyFor(item.action);
          const Icon = copy.icon;
          const taskId = item.metadata.taskId;
          const href =
            item.action === "member.invited"
              ? "/people"
              : typeof taskId === "string"
                ? `/tasks/${taskId}`
                : `/projects/${item.project.id}`;
          return (
            <Link className="activity-item" href={href} key={item.id}>
              <span className="activity-icon" aria-hidden="true">
                <Icon size={16} />
              </span>
              <div className="activity-copy">
                <p>
                  <strong>{item.actor.name}</strong> {copy.label}
                </p>
                <span className="activity-project">{item.project.name}</span>
                <time dateTime={item.createdAt}>
                  {relativeDate(item.createdAt)}
                </time>
              </div>
            </Link>
          );
        })}
        {activities.length === 0 && (
          <p className="activity-empty">No activity yet.</p>
        )}
      </div>
      {nextCursor && (
        <button
          type="button"
          className="activity-load-more"
          onClick={() => void loadMore()}
          disabled={loading}
        >
          {loading ? "Loading…" : "Load older activity"}
        </button>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {loading ? "Loading older activity…" : status}
      </span>
    </section>
  );
}
