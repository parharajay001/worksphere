"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileCheck2,
  FolderKanban,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
type Results = {
  projects: Array<{
    id: string;
    name: string;
    description: string | null;
    status: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    project: { id: string; name: string };
  }>;
};
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>({ projects: [], tasks: [] });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useMemo(
    () => [
      ...results.projects.map((item) => ({
        key: `project-${item.id}`,
        href: `/projects/${item.id}`,
        label: item.name,
      })),
      ...results.tasks.map((item) => ({
        key: `task-${item.id}`,
        href: `/tasks/${item.id}`,
        label: item.title,
      })),
    ],
    [results],
  );
  function close(restore = true) {
    setOpen(false);
    setQuery("");
    setResults({ projects: [], tasks: [] });
    setError("");
    if (restore) requestAnimationFrame(() => trigger.current?.focus());
  }
  function visit(href: string) {
    close(false);
    router.push(href);
  }
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) &&
        !target.isContentEditable
      ) {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    if (open) requestAnimationFrame(() => input.current?.focus());
  }, [open]);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          const body = await response.json();
          setResults(body.data);
          setActive(0);
        })
        .catch((cause) => {
          if (cause instanceof DOMException && cause.name === "AbortError")
            return;
          setError("Search is temporarily unavailable.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setPending(false);
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  function keys(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown" && items.length) {
      event.preventDefault();
      setActive((value) => (value + 1) % items.length);
    } else if (event.key === "ArrowUp" && items.length) {
      event.preventDefault();
      setActive((value) => (value - 1 + items.length) % items.length);
    } else if (event.key === "Enter" && items[active]) {
      event.preventDefault();
      visit(items[active].href);
    }
  }
  function changeQuery(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults({ projects: [], tasks: [] });
      setPending(false);
      setError("");
    } else {
      setPending(true);
      setError("");
    }
  }
  return (
    <>
      <button
        ref={trigger}
        className="global-search"
        type="button"
        aria-label="Search WorkSphere"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Search size={16} aria-hidden="true" />
        <span>Search projects and tasks</span>
        <kbd>/</kbd>
      </button>
      {open && (
        <div
          className="search-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            className="search-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Search WorkSphere"
            onKeyDown={keys}
          >
            <div className="search-input-row">
              <Search size={20} aria-hidden="true" />
              <input
                ref={input}
                value={query}
                onChange={(event) => changeQuery(event.target.value)}
                placeholder="Search projects and tasks…"
                aria-label="Search query"
                aria-controls="global-search-results"
                autoComplete="off"
              />
              {pending && (
                <LoaderCircle
                  className="spin"
                  size={18}
                  aria-label="Searching"
                />
              )}
              <button
                type="button"
                aria-label="Close search"
                onClick={() => close()}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div
              id="global-search-results"
              className="search-results"
              aria-live="polite"
            >
              {query.trim().length < 2 ? (
                <div className="search-prompt">
                  <span>/</span>
                  <div>
                    <strong>Start with two characters</strong>
                    <p>
                      Find work by project name, task title, or description.
                    </p>
                  </div>
                </div>
              ) : error ? (
                <p className="search-error" role="alert">
                  {error}
                </p>
              ) : !pending && items.length === 0 ? (
                <div className="search-empty">
                  <strong>No work matches “{query.trim()}”</strong>
                  <p>Try a shorter phrase or a different keyword.</p>
                </div>
              ) : (
                <>
                  {results.projects.length > 0 && (
                    <div className="search-group">
                      <p>Projects</p>
                      {results.projects.map((project) => {
                        const index = items.findIndex(
                          (item) => item.key === `project-${project.id}`,
                        );
                        return (
                          <button
                            key={project.id}
                            className={index === active ? "active" : ""}
                            onMouseEnter={() => setActive(index)}
                            onClick={() => visit(`/projects/${project.id}`)}
                          >
                            <span className="search-result-icon">
                              <FolderKanban size={16} aria-hidden="true" />
                            </span>
                            <span>
                              <strong>{project.name}</strong>
                              <small>
                                {project.description ?? "Project workspace"}
                              </small>
                            </span>
                            <em>{project.status.toLowerCase()}</em>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {results.tasks.length > 0 && (
                    <div className="search-group">
                      <p>Tasks</p>
                      {results.tasks.map((task) => {
                        const index = items.findIndex(
                          (item) => item.key === `task-${task.id}`,
                        );
                        return (
                          <button
                            key={task.id}
                            className={index === active ? "active" : ""}
                            onMouseEnter={() => setActive(index)}
                            onClick={() => visit(`/tasks/${task.id}`)}
                          >
                            <span className="search-result-icon task">
                              <FileCheck2 size={16} aria-hidden="true" />
                            </span>
                            <span>
                              <strong>{task.title}</strong>
                              <small>{task.project.name}</small>
                            </span>
                            <em>
                              {task.status.toLowerCase().replace("_", " ")}
                            </em>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
            <footer>
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> navigate
              </span>
              <span>
                <kbd>↵</kbd> open
              </span>
              <span>
                <kbd>esc</kbd> close
              </span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
