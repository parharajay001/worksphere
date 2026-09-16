"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
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
} from "lucide-react";
import {
  reorderTasks,
  statusLabels,
  taskStatuses,
  type Board,
  type BoardTask,
  type TaskStatus,
} from "@/modules/tasks/board";

type Move = (id: string, status: TaskStatus, index: number) => void;

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
            {new Date(task.dueDate).toLocaleDateString("en-US", {
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
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            className="board-icon"
            disabled={disabled || index === count - 1}
            title="Move down"
            aria-label={`Move ${task.title} down`}
            onClick={() => move(task.id, task.status, index + 1)}
          >
            <ArrowDown size={14} />
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
  move,
}: {
  status: TaskStatus;
  tasks: BoardTask[];
  editable: boolean;
  disabled: boolean;
  move: Move;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    disabled: !editable || disabled,
  });
  return (
    <section
      className={`kanban-column column-${status.toLowerCase()}${isOver ? " is-over" : ""}`}
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
}: {
  projectId: string;
  initialBoard: Board;
  canManage: boolean;
}) {
  const [board, setBoard] = useState(initialBoard);
  const [pending, setPending] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [title, setTitle] = useState("");
  const busy = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const endpoint = `/api/projects/${projectId}/board`;

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

  function onDragEnd({ active, over }: DragEndEvent) {
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
    if (busy.current || needsRefresh || !title.trim()) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, title: title.trim() }),
      });
      if (!response.ok) throw new Error("Task could not be created.");
      setTitle("");
      await reloadBoard();
      setAnnouncement("Task added to To do.");
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
            Board <span>{board.tasks.length}</span>
          </h2>
          <p>
            {board.tasks.filter((task) => task.status === "DONE").length}{" "}
            completed
          </p>
        </div>
        <div className="board-toolbar-actions">
          {canManage && (
            <form onSubmit={create} className="board-create">
              <input
                aria-label="New task title"
                placeholder="Task title"
                value={title}
                maxLength={200}
                onChange={(event) => setTitle(event.target.value)}
                disabled={pending || needsRefresh}
                required
              />
              <button
                className="board-icon add-task"
                title="Add task"
                aria-label="Add task"
                disabled={pending || needsRefresh || !title.trim()}
              >
                <Plus size={18} />
              </button>
            </form>
          )}
          <button
            type="button"
            className="board-icon"
            title="Refresh board"
            aria-label="Refresh board"
            disabled={pending}
            onClick={() => void refresh()}
          >
            <RefreshCw size={17} />
          </button>
        </div>
      </div>
      <div className="board-feedback">
        <span role="status" aria-live="polite">
          {pending ? "Saving..." : announcement}
        </span>
        {!canManage && <span>Read only</span>}
      </div>
      {error && (
        <p className="board-error" role="alert">
          {error}
        </p>
      )}
      <DndContext
        id={`board-${projectId}`}
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={onDragEnd}
      >
        <div className="kanban-columns" aria-busy={pending}>
          {taskStatuses.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={board.tasks
                .filter((task) => task.status === status)
                .sort((a, b) => a.position - b.position)}
              editable={canManage}
              disabled={pending || needsRefresh}
              move={(...args) => void move(...args)}
            />
          ))}
        </div>
      </DndContext>
    </section>
  );
}
