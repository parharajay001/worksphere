"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { CheckCheck, LoaderCircle, RefreshCw, Send } from "lucide-react";
import { realtimeSocket, subscribeRealtimeRoom } from "@/realtime/client";

type Participant = { id: string; name: string };
type ReadState = { userId: string; name: string; lastReadAt: string };
type Message = {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  author: Participant;
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
  readBy: ReadState[];
};

const chatTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

export function ConversationChat({
  scope,
  conversationId,
  currentUserId,
  participants,
  initialPage,
  title,
}: {
  scope: { kind: "project" | "team"; id: string };
  conversationId: string;
  currentUserId: string;
  participants: Participant[];
  initialPage: Page;
  title: string;
}) {
  const [messages, setMessages] = useState(initialPage.messages);
  const [readBy, setReadBy] = useState(initialPage.readBy);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState<"send" | "history" | "refresh" | "">(
    "",
  );
  const [error, setError] = useState("");
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endpoint = `/api/chat/conversations/${conversationId}/messages`;
  const participantById = useMemo(
    () => new Map(participants.map((person) => [person.id, person])),
    [participants],
  );

  const markRead = useCallback(() => {
    void fetch(`/api/chat/conversations/${conversationId}/read`, {
      method: "POST",
    });
  }, [conversationId]);

  const refreshLatest = useCallback(
    async (showError = false) => {
      if (showError) setPending("refresh");
      try {
        const response = await fetch(`${endpoint}?limit=30`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error();
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
        setReadBy(result.data.page.readBy);
        setError("");
        markRead();
      } catch {
        if (showError)
          setError(
            "Chat could not be refreshed. Check your connection and retry.",
          );
      } finally {
        if (showError) setPending("");
      }
    },
    [endpoint, markRead],
  );

  useEffect(() => {
    const socket = realtimeSocket();
    const target = scope;
    const onMessage = (event: { conversationId: string }) => {
      if (event.conversationId === conversationId) void refreshLatest();
    };
    const onRead = (event: {
      conversationId: string;
      userId: string;
      lastReadAt: string;
    }) => {
      if (
        event.conversationId !== conversationId ||
        event.userId === currentUserId
      )
        return;
      const person = participantById.get(event.userId);
      if (!person) return;
      setReadBy((current) => [
        {
          userId: event.userId,
          name: person.name,
          lastReadAt: event.lastReadAt,
        },
        ...current.filter((item) => item.userId !== event.userId),
      ]);
    };
    const onTyping = (event: {
      roomId: string;
      userId: string;
      active: boolean;
    }) => {
      if (event.roomId !== scope.id || event.userId === currentUserId) return;
      setTypingUsers((current) => {
        const next = new Set(current);
        if (event.active) next.add(event.userId);
        else next.delete(event.userId);
        return next;
      });
    };
    const onPresence = (event: { userIds: string[] }) =>
      setOnlineUsers(event.userIds);
    const unsubscribeRoom = subscribeRealtimeRoom(target);
    socket.on("chat.message", onMessage);
    socket.on("chat.read", onRead);
    socket.on("chat.typing", onTyping);
    socket.on("presence.changed", onPresence);
    markRead();
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      socket.emit("chat:typing", { target, active: false });
      socket.off("chat.message", onMessage);
      socket.off("chat.read", onRead);
      socket.off("chat.typing", onTyping);
      socket.off("presence.changed", onPresence);
      unsubscribeRoom();
    };
  }, [
    conversationId,
    currentUserId,
    markRead,
    participantById,
    refreshLatest,
    scope,
  ]);

  function announceTyping(value: string) {
    setBody(value);
    const socket = realtimeSocket();
    socket.emit("chat:typing", {
      target: scope,
      active: Boolean(value.trim()),
    });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(
      () => socket.emit("chat:typing", { target: scope, active: false }),
      1_500,
    );
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || pending) return;
    setPending("send");
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          result?.error?.code === "PLAN_LIMIT_REACHED"
            ? "This workspace has used its monthly chat allowance. Upgrade the plan to keep the conversation moving."
            : "Message could not be sent. Your draft is safe—try again.",
        );
      }
      const result = (await response.json()) as { data: { message: Message } };
      setMessages((current) => [result.data.message, ...current]);
      announceTyping("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Message could not be sent. Your draft is safe—try again.",
      );
    } finally {
      setPending("");
    }
  }

  async function loadOlder() {
    if (!nextCursor || pending) return;
    setPending("history");
    setError("");
    try {
      const response = await fetch(
        `${endpoint}?limit=30&cursor=${encodeURIComponent(nextCursor)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error();
      const result = (await response.json()) as { data: { page: Page } };
      setMessages((current) => [...current, ...result.data.page.messages]);
      setNextCursor(result.data.page.nextCursor);
      setReadBy(result.data.page.readBy);
    } catch {
      setError("Older messages could not be loaded. Retry when you’re ready.");
    } finally {
      setPending("");
    }
  }

  const onlinePeople = onlineUsers
    .map((id) => participantById.get(id))
    .filter((person): person is Participant => Boolean(person));
  const typingNames = [...typingUsers]
    .map((id) => participantById.get(id)?.name)
    .filter(Boolean);

  return (
    <section className="chat-panel" aria-labelledby="conversation-chat-title">
      <header className="chat-heading">
        <div>
          <p className="eyebrow accent">Live room</p>
          <h2 id="conversation-chat-title">{title}</h2>
        </div>
        <div
          className="chat-presence"
          aria-label={`${onlinePeople.length} people online`}
        >
          <span className="presence-pulse" />
          {onlinePeople.length ? (
            onlinePeople.map((person) => (
              <span
                className="presence-person"
                key={person.id}
                title={person.name}
              >
                {person.name}
              </span>
            ))
          ) : (
            <span>No one else online</span>
          )}
        </div>
      </header>
      {nextCursor && (
        <button
          className="chat-history-button"
          type="button"
          onClick={() => void loadOlder()}
          disabled={Boolean(pending)}
        >
          {pending === "history" ? (
            <>
              <LoaderCircle className="spin" size={13} aria-hidden="true" />{" "}
              Loading history…
            </>
          ) : (
            "Load older messages"
          )}
        </button>
      )}
      <div
        className="chat-messages"
        aria-live="polite"
        aria-busy={pending === "refresh"}
      >
        {[...messages].reverse().map((message) => {
          const readers =
            message.author.id === currentUserId
              ? readBy.filter(
                  (state) =>
                    new Date(state.lastReadAt) >= new Date(message.createdAt),
                )
              : [];
          return (
            <article
              className={`chat-message${message.author.id === currentUserId ? " chat-message-own" : ""}`}
              key={message.id}
            >
              <strong>
                {message.author.id === currentUserId
                  ? "You"
                  : message.author.name}
              </strong>
              <p>{message.body}</p>
              <div className="chat-message-meta">
                <time dateTime={message.createdAt}>
                  {chatTimeFormatter.format(new Date(message.createdAt))}
                </time>
                {readers.length > 0 && (
                  <span title={readers.map((reader) => reader.name).join(", ")}>
                    <CheckCheck size={12} aria-hidden="true" /> Seen by{" "}
                    {readers.length}
                  </span>
                )}
              </div>
            </article>
          );
        })}
        {messages.length === 0 && (
          <div className="chat-empty">
            <span>✦</span>
            <p>No messages yet. Start the room with a clear update.</p>
          </div>
        )}
      </div>
      <p className="chat-typing" aria-live="polite">
        {typingNames.length
          ? `${typingNames.join(", ")} ${typingNames.length === 1 ? "is" : "are"} typing…`
          : "\u00a0"}
      </p>
      {error && (
        <div className="chat-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void refreshLatest(true)}
            disabled={Boolean(pending)}
          >
            <RefreshCw size={13} aria-hidden="true" /> Retry
          </button>
        </div>
      )}
      <form className="chat-composer" onSubmit={send}>
        <input
          name="message"
          autoComplete="off"
          value={body}
          onChange={(event) => announceTyping(event.target.value)}
          maxLength={4000}
          placeholder={`Message the ${scope.kind}…`}
          aria-label="Chat message"
          disabled={Boolean(pending)}
        />
        <button
          type="submit"
          disabled={Boolean(pending) || !body.trim()}
          aria-label="Send message"
        >
          {pending === "send" ? (
            <LoaderCircle className="spin" size={17} aria-hidden="true" />
          ) : (
            <Send size={17} aria-hidden="true" />
          )}
        </button>
      </form>
      <span className="sr-only" role="status" aria-live="polite">
        {pending === "send"
          ? "Sending message…"
          : pending === "history"
            ? "Loading older messages…"
            : pending === "refresh"
              ? "Refreshing chat…"
              : ""}
      </span>
    </section>
  );
}
