"use client";

import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  AtSign,
  Check,
  LoaderCircle,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import type { MentionCandidate } from "@/modules/comments/mentions";

type Comment = {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; email: string };
};
type Page = { comments: Comment[]; nextCursor: string | null };

function relativeDate(value: string) {
  const date = new Date(value);
  const age = Date.now() - date.getTime();
  if (age < 60_000) return "just now";
  if (age < 3_600_000) return `${Math.floor(age / 60_000)}m ago`;
  if (age < 86_400_000) return `${Math.floor(age / 3_600_000)}h ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function mentionRange(value: string, cursor: number) {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(
    /(?:^|[^A-Za-z0-9_.@-])@([A-Za-z0-9][A-Za-z0-9_.-]{0,63})?$/,
  );
  if (!match) return null;
  const query = match[1] ?? "";
  return {
    start: cursor - query.length - 1,
    end: cursor,
    query: query.toLowerCase(),
  };
}

function mentionToken(candidate: MentionCandidate) {
  return candidate.email.slice(0, candidate.email.indexOf("@")).toLowerCase();
}

function normalizedName(candidate: MentionCandidate) {
  return candidate.name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function TaskComments({
  taskId,
  currentUserId,
  canManage,
  initialPage,
  mentionCandidates,
}: {
  taskId: string;
  currentUserId: string;
  canManage: boolean;
  initialPage: Page;
  mentionCandidates: MentionCandidate[];
}) {
  const [comments, setComments] = useState(initialPage.comments);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [mention, setMention] = useState<ReturnType<typeof mentionRange>>(null);
  const [activeMention, setActiveMention] = useState(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const endpoint = `/api/tasks/${taskId}/comments`;
  const mentionMatches = useMemo(() => {
    if (!mention) return [];
    return mentionCandidates
      .filter((candidate) => {
        const search = mention.query;
        return (
          candidate.name.toLowerCase().includes(search) ||
          normalizedName(candidate).includes(search) ||
          candidate.email.toLowerCase().includes(search) ||
          mentionToken(candidate).includes(search)
        );
      })
      .slice(0, 6);
  }, [mention, mentionCandidates]);

  function updateMention(value: string, cursor: number) {
    const next = mentionRange(value, cursor);
    setMention(next);
    setActiveMention(0);
  }

  function chooseMention(candidate: MentionCandidate) {
    if (!mention) return;
    const token = `@${mentionToken(candidate)} `;
    const nextBody = `${body.slice(0, mention.start)}${token}${body.slice(mention.end)}`;
    const nextCursor = mention.start + token.length;
    setBody(nextBody);
    setMention(null);
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!mention || mentionMatches.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveMention((current) => (current + 1) % mentionMatches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveMention(
        (current) =>
          (current - 1 + mentionMatches.length) % mentionMatches.length,
      );
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      chooseMention(mentionMatches[activeMention]!);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setMention(null);
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || pending) return;
    setPending("create");
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setComments((current) => [result.data.comment, ...current]);
      setBody("");
      setStatus("Comment posted.");
    } catch {
      setError("Comment could not be posted. Try again.");
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
        `${endpoint}?limit=20&cursor=${encodeURIComponent(nextCursor)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error();
      const result = (await response.json()) as { data: Page };
      setComments((current) => [...current, ...result.data.comments]);
      setNextCursor(result.data.nextCursor);
    } catch {
      setError("More comments could not be loaded. Try again.");
    } finally {
      setPending(null);
    }
  }

  function startEdit(comment: Comment) {
    setEditingId(comment.id);
    setEditingBody(comment.body);
    setError("");
  }

  async function saveEdit(id: string) {
    if (!editingBody.trim() || pending) return;
    setPending(id);
    setError("");
    try {
      const response = await fetch(`/api/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editingBody.trim() }),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setComments((current) =>
        current.map((comment) =>
          comment.id === id ? result.data.comment : comment,
        ),
      );
      setEditingId(null);
      setStatus("Comment updated.");
    } catch {
      setError("Comment could not be updated. Try again.");
    } finally {
      setPending(null);
    }
  }

  async function remove(id: string) {
    if (pending || !window.confirm("Delete this comment?")) return;
    setPending(id);
    setError("");
    try {
      const response = await fetch(`/api/comments/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setComments((current) => current.filter((comment) => comment.id !== id));
      setStatus("Comment deleted.");
    } catch {
      setError("Comment could not be deleted. Try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="comments-panel" aria-labelledby="comments-title">
      <div className="comments-heading">
        <div>
          <p className="eyebrow accent">Discussion</p>
          <h2 id="comments-title">
            Comments{" "}
            <span>
              {comments.length}
              {nextCursor ? "+" : ""}
            </span>
          </h2>
        </div>
        <span className="comments-hint">Visible to project members</span>
      </div>
      <form className="comment-composer" onSubmit={addComment}>
        <label htmlFor="new-comment">Add a comment</label>
        <span className="comment-mention-hint">
          Mention a project member with @name or @email.
        </span>
        <div className="comment-compose-row">
          <div className="comment-input-wrap">
            <textarea
              ref={composerRef}
              id="new-comment"
              value={body}
              maxLength={5000}
              rows={3}
              placeholder="Share an update or useful context..."
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={mention !== null}
              aria-controls="mention-suggestions"
              onChange={(event) => {
                setBody(event.target.value);
                updateMention(event.target.value, event.target.selectionStart);
              }}
              onClick={(event) =>
                updateMention(
                  event.currentTarget.value,
                  event.currentTarget.selectionStart,
                )
              }
              onKeyUp={(event) =>
                !["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(
                  event.key,
                ) &&
                updateMention(
                  event.currentTarget.value,
                  event.currentTarget.selectionStart,
                )
              }
              onKeyDown={handleComposerKeyDown}
              disabled={pending !== null}
            />
            {mention && (
              <div
                className="mention-suggestions"
                id="mention-suggestions"
                role="listbox"
                aria-label="Mention suggestions"
              >
                <div className="mention-suggestions-heading">
                  <span>
                    <AtSign size={13} aria-hidden="true" />
                    Mention a teammate
                  </span>
                  <small>↑ ↓ &nbsp; select</small>
                </div>
                {mentionMatches.length > 0 ? (
                  mentionMatches.map((candidate, index) => (
                    <button
                      className={
                        index === activeMention
                          ? "mention-option active"
                          : "mention-option"
                      }
                      key={candidate.id}
                      type="button"
                      role="option"
                      aria-selected={index === activeMention}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => chooseMention(candidate)}
                    >
                      <span className="mention-avatar" aria-hidden="true">
                        {candidate.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span>
                        <strong>{candidate.name}</strong>
                        <small>{candidate.email}</small>
                      </span>
                      <span className="mention-option-handle">
                        @{mentionToken(candidate)}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="mention-empty">
                    No teammates match &quot;{mention.query}&quot;.
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            type="submit"
            className="comment-send"
            aria-label="Post comment"
            title="Post comment"
            disabled={!body.trim() || pending !== null}
          >
            <Send size={17} />
          </button>
        </div>
      </form>
      <div className="comments-feedback" role="status" aria-live="polite">
        {pending === "load"
          ? "Loading comments..."
          : pending === "create"
            ? "Posting..."
            : status}
      </div>
      {error && (
        <p className="comments-error" role="alert">
          {error}
        </p>
      )}
      <div className="comment-list">
        {comments.map((comment) => {
          const editable = comment.authorId === currentUserId || canManage;
          const isEditing = editingId === comment.id;
          return (
            <article className="comment" key={comment.id}>
              <div className="comment-avatar" aria-hidden="true">
                {comment.author.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="comment-content">
                <header>
                  <strong>{comment.author.name}</strong>
                  <time dateTime={comment.createdAt}>
                    {relativeDate(comment.createdAt)}
                  </time>
                  {comment.updatedAt !== comment.createdAt && (
                    <span className="comment-edited">edited</span>
                  )}
                </header>
                {isEditing ? (
                  <div className="comment-edit">
                    <textarea
                      aria-label="Edit comment"
                      value={editingBody}
                      maxLength={5000}
                      rows={3}
                      onChange={(event) => setEditingBody(event.target.value)}
                      disabled={pending === comment.id}
                    />
                    <div>
                      <button
                        type="button"
                        className="comment-action"
                        title="Save comment"
                        aria-label="Save comment"
                        onClick={() => void saveEdit(comment.id)}
                        disabled={!editingBody.trim() || pending === comment.id}
                      >
                        {pending === comment.id ? (
                          <LoaderCircle className="spin" size={15} />
                        ) : (
                          <Check size={15} />
                        )}
                      </button>
                      <button
                        type="button"
                        className="comment-action"
                        title="Cancel editing"
                        aria-label="Cancel editing"
                        onClick={() => setEditingId(null)}
                        disabled={pending === comment.id}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <p>{comment.body}</p>
                )}
                {editable && !isEditing && (
                  <div className="comment-actions">
                    <button
                      type="button"
                      className="comment-action"
                      title="Edit comment"
                      aria-label={`Edit comment by ${comment.author.name}`}
                      onClick={() => startEdit(comment)}
                      disabled={pending !== null}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="comment-action danger"
                      title="Delete comment"
                      aria-label={`Delete comment by ${comment.author.name}`}
                      onClick={() => void remove(comment.id)}
                      disabled={pending !== null}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
        {comments.length === 0 && (
          <p className="comments-empty">
            No comments yet. Start the discussion.
          </p>
        )}
      </div>
      {nextCursor && (
        <button
          type="button"
          className="comments-load-more"
          onClick={() => void loadMore()}
          disabled={pending !== null}
        >
          {pending === "load" ? "Loading..." : "Load older comments"}
        </button>
      )}
    </section>
  );
}
