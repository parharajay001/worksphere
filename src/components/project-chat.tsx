"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Paperclip, Send } from "lucide-react";
import { realtimeSocket, subscribeRealtimeRoom } from "@/realtime/client";

type Message = {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
  attachments: {
    id: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  }[];
};
type Page = {
  messages: Message[];
  nextCursor: string | null;
  lastReadAt: string | null;
};

const chatTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "UTC",
});

export function ProjectChat({
  projectId,
  conversationId,
  currentUserId,
  initialPage,
}: {
  projectId: string;
  conversationId: string;
  currentUserId: string;
  initialPage: Page;
}) {
  const [messages, setMessages] = useState(initialPage.messages);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endpoint = `/api/chat/conversations/${conversationId}/messages`;

  const refreshLatest = useCallback(async () => {
    try {
      const response = await fetch(`${endpoint}?limit=30`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const result = (await response.json()) as { data: { page: Page } };
      setMessages((current) => {
        const latest = new Map(
          result.data.page.messages.map((item) => [item.id, item]),
        );
        for (const item of current)
          if (!latest.has(item.id)) latest.set(item.id, item);
        return [...latest.values()].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      });
      void fetch(`/api/chat/conversations/${conversationId}/read`, {
        method: "POST",
      });
    } catch {
      // A reconnect or manual navigation will reconcile from REST.
    }
  }, [conversationId, endpoint]);

  useEffect(() => {
    const socket = realtimeSocket();
    const target = { kind: "project" as const, id: projectId };
    const unsubscribeRoom = subscribeRealtimeRoom(target);
    const onMessage = (event: { conversationId: string }) => {
      if (event.conversationId === conversationId) void refreshLatest();
    };
    const onTyping = (event: {
      roomId: string;
      userId: string;
      active: boolean;
    }) => {
      if (event.roomId !== projectId || event.userId === currentUserId) return;
      setTypingUsers((current) => {
        const next = new Set(current);
        if (event.active) next.add(event.userId);
        else next.delete(event.userId);
        return next;
      });
    };
    const onPresence = (event: { userIds: string[] }) =>
      setOnlineUsers(event.userIds);
    socket.on("chat.message", onMessage);
    socket.on("chat.typing", onTyping);
    socket.on("presence.changed", onPresence);
    void fetch(`/api/chat/conversations/${conversationId}/read`, {
      method: "POST",
    });
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      socket.emit("chat:typing", { target, active: false });
      socket.off("chat.message", onMessage);
      socket.off("chat.typing", onTyping);
      socket.off("presence.changed", onPresence);
      unsubscribeRoom();
    };
  }, [conversationId, currentUserId, projectId, refreshLatest]);

  function announceTyping(value: string) {
    setBody(value);
    const socket = realtimeSocket();
    const target = { kind: "project" as const, id: projectId };
    socket.emit("chat:typing", { target, active: Boolean(value.trim()) });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(
      () => socket.emit("chat:typing", { target, active: false }),
      1_500,
    );
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      if (!response.ok) throw new Error();
      const result = (await response.json()) as { data: { message: Message } };
      setMessages((current) => [result.data.message, ...current]);
      announceTyping("");
    } catch {
      setError("Message could not be sent. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function loadOlder() {
    if (!nextCursor || pending) return;
    setPending(true);
    try {
      const response = await fetch(
        `${endpoint}?limit=30&cursor=${nextCursor}`,
        {
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error();
      const result = (await response.json()) as { data: { page: Page } };
      setMessages((current) => [...current, ...result.data.page.messages]);
      setNextCursor(result.data.page.nextCursor);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="chat-panel" aria-labelledby="project-chat-title">
      <header className="chat-heading">
        <div>
          <p className="eyebrow accent">Live room</p>
          <h2 id="project-chat-title">Project chat</h2>
        </div>
        <span>{onlineUsers.length} online</span>
      </header>
      {nextCursor && (
        <button
          type="button"
          onClick={() => void loadOlder()}
          disabled={pending}
        >
          Load older messages
        </button>
      )}
      <div className="chat-messages" aria-live="polite">
        {[...messages].reverse().map((message) => (
          <article className="chat-message" key={message.id}>
            <strong>{message.author.name}</strong>
            <p>{message.body}</p>
            <time dateTime={message.createdAt}>
              {chatTimeFormatter.format(new Date(message.createdAt))} UTC
            </time>
          </article>
        ))}
        {messages.length === 0 && <p>No messages yet. Say hello.</p>}
      </div>
      <p className="chat-typing" aria-live="polite">
        {typingUsers.size > 0 ? "Someone is typing…" : "\u00a0"}
      </p>
      {error && (
        <p className="comments-error" role="alert">
          {error}
        </p>
      )}
      <form className="chat-composer" onSubmit={send}>
        <button
          type="button"
          disabled
          title="Attachments will use object storage"
        >
          <Paperclip size={17} />
          <span className="sr-only">Attach a file (coming soon)</span>
        </button>
        <input
          value={body}
          onChange={(event) => announceTyping(event.target.value)}
          maxLength={4000}
          placeholder="Message the project…"
          aria-label="Chat message"
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending || !body.trim()}
          aria-label="Send message"
        >
          <Send size={17} />
        </button>
      </form>
    </section>
  );
}
