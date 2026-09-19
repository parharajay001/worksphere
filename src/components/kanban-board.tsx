"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  GripVertical,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  reorderTasks,
  statusLabels,
  taskStatuses,
  type Board,
  type BoardTask,
  type TaskStatus,
} from "@/modules/tasks/board";
import { useRealtimeRoom } from "@/realtime/use-realtime-room";
import { useModalDialog } from "@/lib/ui/use-modal-dialog";

type Move = (id: string, status: TaskStatus, index: number) => void;
type Member = { id: string; name: string; email: string };

function DragTaskCard({ task }: { task: BoardTask }) {
  return (
    <article className="kanban-task kanban-drag-overlay" aria-hidden="true">
      <div className="kanban-task-top">
        <span
          className={`task-priority priority-${task.priority.toLowerCase()}`}
        >
          {task.priority.toLowerCase()}
        </span>
        <GripVertical size={16} aria-hidden="true" />
      </div>
      <strong className="kanban-task-title">{task.title}</strong>
      <div className="kanban-task-meta">
        <span className="task-person">
          <span className="task-avatar" aria-hidden="true">
            {task.assignee?.name.slice(0, 1).toUpperCase() ?? "-"}
          </span>
          {task.assignee?.name ?? "Unassigned"}
        </span>
        {task.dueDate && (
          <time dateTime={task.dueDate}>
            <CalendarDays size={13} aria-hidden="true" />
            {new Date(task.dueDate).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}
          </time>
        )}
      </div>
    </article>
  );
}

function TaskCard({
  task,
  index,
  count,
  editable,
  disabled,
  move,
}: {
  task: BoardTask;
  index: number;
  count: number;
  editable: boolean;
  disabled: boolean;
  move: Move;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: !editable || disabled });
  return (
    <article
      ref={setNodeRef}
      className={`kanban-task${isDragging ? " is-dragging" : ""}`}
      data-task-id={task.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={task.title}
    >
      <div className="kanban-task-top">
        <span
          className={`task-priority priority-${task.priority.toLowerCase()}`}
        >
          {task.priority.toLowerCase()}
        </span>
        {editable && (
          <button
            ref={setActivatorNodeRef}
            className="board-icon drag-handle"
            type="button"
            {...attributes}
            {...listeners}
            disabled={disabled}
            aria-label={`Move ${task.title}`}
            title="Drag task"
          >
            <GripVertical size={16} />
          </button>
        )}
      </div>
      <Link className="kanban-task-title" href={`/tasks/${task.id}`}>
        {task.title}
      </Link>
      <div className="kanban-task-meta">
        <span className="task-person">
          <span className="task-avatar" aria-hidden="true">
            {task.assignee?.name.slice(0, 1).toUpperCase() ?? "-"}
          </span>
          {task.assignee?.name ?? "Unassigned"}
        </span>
        {task.dueDate && (
          <time dateTime={task.dueDate}>
            <CalendarDays size={13} aria-hidden="true" />
            {new Date(task.dueDate).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}
          </time>
        )}
      </div>
      {editable && (
        <div className="kanban-task-controls">
          <select
            aria-label={`Status for ${task.title}`}
            value={task.status}
            disabled={disabled}
            onChange={(event) =>
              move(task.id, event.target.value as TaskStatus, 0)
            }
          >
            {taskStatuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="board-icon"
            disabled={disabled || index === 0}
            title="Move up"
            aria-label={`Move ${task.title} up`}
            onClick={() => move(task.id, task.status, index - 1)}
          >
            <ArrowUp size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="board-icon"
            disabled={disabled || index === count - 1}
            title="Move down"
            aria-label={`Move ${task.title} down`}
            onClick={() => move(task.id, task.status, index + 1)}
          >
            <ArrowDown size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </article>
  );
}

function Column({
  status,
  tasks,
  editable,
  disabled,
  dragTarget,
  move,
}: {
  status: TaskStatus;
  tasks: BoardTask[];
  editable: boolean;
  disabled: boolean;
  dragTarget: boolean;
  move: Move;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    disabled: !editable || disabled,
  });
  return (
    <section
      className={`kanban-column column-${status.toLowerCase()}${isOver ? " is-over" : ""}${dragTarget ? " drag-target" : ""}`}
      aria-label={statusLabels[status]}
    >
      <header>
        <h3>
          <span className="column-marker" />
          {statusLabels[status]}
        </h3>
        <span className="column-count">{tasks.length}</span>
      </header>
      <div ref={setNodeRef} className="kanban-dropzone" data-column={status}>
        {dragTarget && (
          <div className="kanban-drop-indicator" aria-hidden="true">
            Drop in {statusLabels[status]}
          </div>
        )}
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              index={index}
              count={tasks.length}
              editable={editable}
              disabled={disabled}
              move={move}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && <p className="kanban-empty">No tasks</p>}
      </div>
    </section>
  );
}

export function KanbanBoard({
  projectId,
  initialBoard,
  canManage,
  members,
}: {
  projectId: string;
  initialBoard: Board;
  canManage: boolean;
  members: Member[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [board, setBoard] = useState(initialBoard);
  const [pending, setPending] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [creating, setCreating] = useState(false);
  const createDialogRef = useModalDialog<HTMLElement>(creating, () =>
    setCreating(false),
  );
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") ?? "",
  );
  const [priorityFilter, setPriorityFilter] = useState(
    searchParams.get("priority") ?? "",
  );
  const [assigneeFilter, setAssigneeFilter] = useState(
    searchParams.get("assignee") ?? "",
  );
  const [dueFilter, setDueFilter] = useState(searchParams.get("due") ?? "");
  const busy = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const endpoint = `/api/projects/${projectId}/board`;
  const hasFilters = Boolean(
    query || statusFilter || priorityFilter || assigneeFilter || dueFilter,
  );
  const filteredTasks = useMemo(() => {
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 86_400_000);
    return board.tasks.filter((task) => {
      const due = task.dueDate ? new Date(task.dueDate) : null;
      return (
        (!query || task.title.toLowerCase().includes(query.toLowerCase())) &&
        (!statusFilter || task.status === statusFilter) &&
        (!priorityFilter || task.priority === priorityFilter) &&
        (!assigneeFilter ||
          (assigneeFilter === "unassigned"
            ? !task.assignee
            : task.assignee?.id === assigneeFilter)) &&
        (!dueFilter ||
          (dueFilter === "overdue" &&
            due &&
            due < now &&
            task.status !== "DONE") ||
          (dueFilter === "next7" && due && due >= now && due <= week) ||
          (dueFilter === "none" && !due))
      );
    });
  }, [
    assigneeFilter,
    board.tasks,
    dueFilter,
    priorityFilter,
    query,
    statusFilter,
  ]);
  const activeTask = activeTaskId
    ? board.tasks.find((task) => task.id === activeTaskId)
    : null;

  function syncFilters(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, {
      scroll: false,
    });
  }

  function clearFilters() {
    setQuery("");
    setStatusFilter("");
    setPriorityFilter("");
    setAssigneeFilter("");
    setDueFilter("");
    router.replace(pathname, { scroll: false });
  }

  useRealtimeRoom<{ projectId: string }>(
    { kind: "project", id: projectId },
    "task.changed",
    (event) => {
      if (event.projectId === projectId && !busy.current) void reloadBoard();
    },
  );

  async function reloadBoard() {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok)
      throw new Error("Could not refresh the board. Try again.");
    const body = await response.json();
    setBoard(body.data.board);
    setNeedsRefresh(false);
  }

  async function refresh() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await reloadBoard();
      setAnnouncement("Board refreshed.");
    } catch {
      setError("Could not refresh the board. Try again.");
      setNeedsRefresh(true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function move(id: string, status: TaskStatus, index: number) {
    if (!canManage || busy.current || needsRefresh) return;
    const previous = board;
    const tasks = reorderTasks(board.tasks, id, status, index);
    if (
      tasks.every((task) => {
        const old = board.tasks.find((item) => item.id === task.id);
        return old?.status === task.status && old.position === task.position;
      })
    )
      return;
    busy.current = true;
    setPending(true);
    setError("");
    setBoard({ ...board, tasks });
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: id,
          status,
          index,
          revision: previous.revision,
        }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? "The board changed in another session. Your move was not applied."
            : "Your move could not be saved.",
        );
      const body = await response.json();
      setBoard(body.data.board);
      setAnnouncement(
        `Task moved to ${statusLabels[status]}, position ${index + 1}.`,
      );
    } catch (failure) {
      setBoard(previous);
      setNeedsRefresh(true);
      setError(
        failure instanceof Error
          ? failure.message
          : "Your move could not be saved.",
      );
      // A lost response may hide a committed write; reload before allowing another move.
      try {
        await reloadBoard();
      } catch {
        setError(
          "Could not confirm the board state. Refresh before making another change.",
        );
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function onDragStart({ active, activatorEvent }: DragStartEvent) {
    if (!(activatorEvent instanceof KeyboardEvent)) {
      setActiveTaskId(String(active.id));
    }
  }

  function statusFromTarget(id: string | number) {
    return (
      board.tasks.find((task) => task.id === id)?.status ??
      taskStatuses.find((status) => status === id) ??
      null
    );
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) {
      setDragOverStatus(null);
      return;
    }
    const targetStatus = statusFromTarget(over.id);
    const sourceStatus = board.tasks.find(
      (task) => task.id === active.id,
    )?.status;
    setDragOverStatus(
      targetStatus && targetStatus !== sourceStatus ? targetStatus : null,
    );
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveTaskId(null);
    setDragOverStatus(null);
    if (!over || active.id === over.id) return;
    const target = board.tasks.find((task) => task.id === over.id);
    const status =
      target?.status ?? taskStatuses.find((item) => item === over.id);
    if (!status) return;
    const column = board.tasks
      .filter((task) => task.status === status)
      .sort((a, b) => a.position - b.position);
    const index = target
      ? column.findIndex((task) => task.id === target.id)
      : column.filter((task) => task.id !== active.id).length;
    void move(String(active.id), status, index);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || needsRefresh) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title") ?? "").trim();
    if (!title) return;
    const dueDate = String(form.get("dueDate") ?? "");
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title,
          description: String(form.get("description") ?? ""),
          status: String(form.get("status") ?? "TODO"),
          priority: String(form.get("priority") ?? "MEDIUM"),
          assigneeId: form.get("assigneeId")
            ? String(form.get("assigneeId"))
            : null,
          dueDate: dueDate
            ? new Date(`${dueDate}T00:00:00.000Z`).toISOString()
            : null,
        }),
      });
      if (!response.ok) throw new Error("Task could not be created.");
      formElement.reset();
      setCreating(false);
      await reloadBoard();
      setAnnouncement("Task created.");
    } catch {
      setError(
        "Could not confirm task creation. Refresh the board before trying again.",
      );
      setNeedsRefresh(true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <section className="kanban" aria-label="Task board">
      <div className="board-toolbar">
        <div>
          <h2>
            Board <span>{filteredTasks.length}</span>
          </h2>
          <p>
            {board.tasks.filter((task) => task.status === "DONE").length}{" "}
            completed
          </p>
        </div>
        <div className="board-toolbar-actions">
          {canManage && (
            <button
              type="button"
              className="primary-link board-new-task"
              onClick={() => setCreating(true)}
              disabled={pending || needsRefresh}
            >
              <Plus size={16} aria-hidden="true" /> New Task
            </button>
          )}
          <button
            type="button"
            className="board-icon"
            title="Refresh board"
            aria-label="Refresh board"
            disabled={pending}
            onClick={() => void refresh()}
          >
            <RefreshCw size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="board-filters" aria-label="Board filters">
        <label className="board-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Search tasks</span>
          <input
            name="q"
            value={query}
            placeholder="Search tasks…"
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
              syncFilters({ q: event.target.value });
            }}
          />
        </label>
        <SlidersHorizontal size={15} aria-hidden="true" />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            syncFilters({ status: event.target.value });
          }}
        >
          <option value="">All statuses</option>
          {taskStatuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by priority"
          value={priorityFilter}
          onChange={(event) => {
            setPriorityFilter(event.target.value);
            syncFilters({ priority: event.target.value });
          }}
        >
          <option value="">All priorities</option>
          {["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => (
            <option key={priority} value={priority}>
              {priority.toLowerCase()}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by assignee"
          value={assigneeFilter}
          onChange={(event) => {
            setAssigneeFilter(event.target.value);
            syncFilters({ assignee: event.target.value });
          }}
        >
          <option value="">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by due date"
          value={dueFilter}
          onChange={(event) => {
            setDueFilter(event.target.value);
            syncFilters({ due: event.target.value });
          }}
        >
          <option value="">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="next7">Next 7 days</option>
          <option value="none">No due date</option>
        </select>
        {hasFilters && (
          <button
            type="button"
            className="board-clear-filters"
            onClick={clearFilters}
          >
            <X size={14} aria-hidden="true" /> Clear
          </button>
        )}
      </div>
      <div className="board-feedback">
        <span role="status" aria-live="polite">
          {pending ? "Saving…" : announcement}
        </span>
        {!canManage && <span>Read only</span>}
      </div>
      {error && (
        <p className="board-error" role="alert">
          {error}
        </p>
      )}
      {hasFilters && filteredTasks.length === 0 && (
        <div className="board-no-results">
          <Search size={22} aria-hidden="true" />
          <strong>No matching tasks</strong>
          <p>Try another search or clear the active filters.</p>
          <button type="button" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      )}
      {creating && (
        <div
          className="task-create-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCreating(false);
          }}
        >
          <section
            ref={createDialogRef}
            className="task-create-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-task-title"
          >
            <header>
              <div>
                <p className="eyebrow accent">Add to the board</p>
                <h2 id="new-task-title">Create a task</h2>
              </div>
              <button
                type="button"
                className="board-icon"
                aria-label="Close task form"
                onClick={() => setCreating(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <form onSubmit={create} className="task-create-form">
              <label>
                Title
                <input
                  name="title"
                  required
                  maxLength={200}
                  placeholder="What needs to get done?"
                />
              </label>
              <label>
                Description <span>Optional</span>
                <textarea
                  name="description"
                  maxLength={5000}
                  placeholder="Add useful context or acceptance criteria"
                />
              </label>
              <div className="task-create-grid">
                <label>
                  Status
                  <select name="status" defaultValue="TODO">
                    {taskStatuses.map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Priority
                  <select name="priority" defaultValue="MEDIUM">
                    <option value="LOW">low</option>
                    <option value="MEDIUM">medium</option>
                    <option value="HIGH">high</option>
                    <option value="URGENT">urgent</option>
                  </select>
                </label>
                <label>
                  Assignee
                  <select name="assigneeId" defaultValue="">
                    <option value="">Unassigned</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Due date
                  <input name="dueDate" type="date" />
                </label>
              </div>
              <div className="settings-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setCreating(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-link"
                  disabled={pending}
                >
                  {pending ? "Creating…" : "Create Task"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      <DndContext
        id={`board-${projectId}`}
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragCancel={() => {
          setActiveTaskId(null);
          setDragOverStatus(null);
        }}
        onDragEnd={onDragEnd}
      >
        <div className="kanban-columns" aria-busy={pending}>
          {taskStatuses.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={filteredTasks
                .filter((task) => task.status === status)
                .sort((a, b) => a.position - b.position)}
              editable={canManage && !hasFilters}
              disabled={pending || needsRefresh}
              dragTarget={dragOverStatus === status}
              move={(...args) => void move(...args)}
            />
          ))}
        </div>
        <DragOverlay
          dropAnimation={{
            duration: 180,
            easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        >
          {activeTask ? <DragTaskCard task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}
