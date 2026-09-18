"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AtSign,
  Bell,
  CheckCheck,
  Clock3,
  LoaderCircle,
  MailCheck,
  Route,
  UserCheck,
} from "lucide-react";
import { useRealtimeUserEvent } from "@/realtime/use-realtime-room";

type Notification = {
  id: string;
  kind: string;
  readAt: string | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  task: { id: string; title: string } | null;
  commentId: string | null;
};
type Page = {
  notifications: Notification[];
  unreadCount: number;
  nextCursor: string | null;
};

function relativeDate(value: string) {
  const age = Date.now() - new Date(value).getTime();
  if (age < 60_000) return "just now";
  if (age < 3_600_000) return `${Math.floor(age / 60_000)}m ago`;
  if (age < 86_400_000) return `${Math.floor(age / 3_600_000)}h ago`;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function NotificationCenter({ initialPage }: { initialPage: Page }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialPage.notifications);
  const [unreadCount, setUnreadCount] = useState(initialPage.unreadCount);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const kindCopy = {
    mention: { verb: "mentioned you in", icon: AtSign },
    invitation: { verb: "welcomed you to", icon: MailCheck },
    assignment: { verb: "assigned you a task in", icon: UserCheck },
    status_change: { verb: "changed a task status in", icon: Route },
    reminder: { verb: "set a due-date reminder in", icon: Clock3 },
  } as const;

  async function reloadNotifications(filter = unreadOnly) {
    try {
      const response = await fetch(
        `/api/notifications?limit=20&unreadOnly=${filter}`,
        {
          cache: "no-store",
        },
      );
      if (!response.ok) return;
      const result = (await response.json()) as { data: Page };
      setNotifications(result.data.notifications);
      setUnreadCount(result.data.unreadCount);
      setNextCursor(result.data.nextCursor);
    } catch {
      // REST remains authoritative; a later event or navigation can reconcile.
    }
  }

  useRealtimeUserEvent("notification.changed", () => {
    void reloadNotifications();
  });

  async function openNotification(item: Notification) {
    if (pending) return;
    const id = item.id;
    const wasUnread = notifications.some(
      (notification) => notification.id === id && !notification.readAt,
    );
    setPending(id);
    setError("");
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
      });
      if (!response.ok) throw new Error();
      setNotifications((current) =>
        current.map((item) =>
          item.id === id && !item.readAt
            ? { ...item, readAt: new Date().toISOString() }
            : item,
        ),
      );
      if (wasUnread) setUnreadCount((current) => Math.max(0, current - 1));
      if (unreadOnly)
        setNotifications((current) =>
          current.filter((entry) => entry.id !== id),
        );
      router.push(
        item.task
          ? `/tasks/${item.task.id}${item.commentId ? `#comment-${item.commentId}` : ""}`
          : item.kind === "invitation"
            ? "/people"
            : item.project
              ? `/projects/${item.project.id}`
              : "/dashboard",
      );
    } catch {
      setError("Notification could not be marked as read.");
    } finally {
      setPending(null);
    }
  }

  async function markAllRead() {
    if (pending || unreadCount === 0) return;
    setPending("all");
    setError("");
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      if (!response.ok) throw new Error();
      const now = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) => ({ ...item, readAt: item.readAt ?? now })),
      );
      if (unreadOnly) setNotifications([]);
      setUnreadCount(0);
    } catch {
      setError("Notifications could not be marked as read.");
    } finally {
      setPending(null);
    }
  }

  async function loadMore() {
    if (!nextCursor || pending) return;
    setPending("load");
    setError("");
    try {
      const response = await fetch(
        `/api/notifications?limit=20&unreadOnly=${unreadOnly}&cursor=${encodeURIComponent(nextCursor)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error();
      const result = (await response.json()) as { data: Page };
      setNotifications((current) => [...current, ...result.data.notifications]);
      setNextCursor(result.data.nextCursor);
    } catch {
      setError("More notifications could not be loaded.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section
      className="notification-center"
      aria-labelledby="notifications-title"
    >
      <div className="notification-center-heading">
        <div>
          <p className="eyebrow accent">Keep in the loop</p>
          <h2 id="notifications-title">
            Notifications <span>{unreadCount || "All caught up"}</span>
          </h2>
        </div>
        <div className="notification-center-actions">
          <Bell size={19} aria-hidden="true" />
          <button
            type="button"
            className="notification-read-all"
            onClick={() => void markAllRead()}
            disabled={pending !== null || unreadCount === 0}
          >
            {pending === "all" ? (
              <LoaderCircle className="spin" size={13} />
            ) : (
              <CheckCheck size={13} />
            )}
            Mark all read
          </button>
        </div>
      </div>
      {error && (
        <p className="comments-error" role="alert">
          {error}
        </p>
      )}
      <div className="notification-list">
        <div className="notification-filters" aria-label="Notification filter">
          <button
            type="button"
            className={!unreadOnly ? "active" : ""}
            onClick={() => {
              setUnreadOnly(false);
              void reloadNotifications(false);
            }}
          >
            All
          </button>
          <button
            type="button"
            className={unreadOnly ? "active" : ""}
            onClick={() => {
              setUnreadOnly(true);
              void reloadNotifications(true);
            }}
          >
            Unread
          </button>
        </div>
        {notifications.map((item) => {
          const presentation =
            kindCopy[item.kind as keyof typeof kindCopy] ?? kindCopy.mention;
          const Icon = presentation.icon;
          return (
            <button
              className={
                item.readAt
                  ? "notification-item"
                  : "notification-item notification-unread"
              }
              key={item.id}
              type="button"
              onClick={() => void openNotification(item)}
              disabled={pending !== null}
            >
              <span className="notification-icon" aria-hidden="true">
                <Icon size={15} />
              </span>
              <span className="notification-copy">
                <span>
                  <strong>{item.actor?.name ?? "WorkSphere"}</strong>{" "}
                  {presentation.verb}{" "}
                  <strong>{item.project?.name ?? "your workspace"}</strong>
                </span>
                {item.task && <small>{item.task.title}</small>}
                <time dateTime={item.createdAt}>
                  {relativeDate(item.createdAt)}
                </time>
              </span>
              {!item.readAt && (
                <span className="notification-dot" aria-label="Unread" />
              )}
            </button>
          );
        })}
        {notifications.length === 0 && (
          <p className="notification-empty">You are all caught up.</p>
        )}
      </div>
      {nextCursor && (
        <button
          type="button"
          className="notification-load-more"
          onClick={() => void loadMore()}
          disabled={pending !== null}
        >
          {pending === "load" ? "Loading..." : "Load older notifications"}
        </button>
      )}
    </section>
  );
}
