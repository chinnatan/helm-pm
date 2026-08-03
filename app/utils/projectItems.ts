import type { Subtask, Task, TaskPriority, TaskStatus } from "~/types";

export type ProjectItem =
  | { kind: "task"; id: string; task: Task }
  | { kind: "subtask"; id: string; subtask: Subtask; parent: Task };

/** Flatten parent tasks and nested subtasks into board/list/calendar items. */
export function flattenProjectItems(tasks: Task[]): ProjectItem[] {
  const items: ProjectItem[] = [];
  for (const task of tasks) {
    items.push({ kind: "task", id: `task:${task.id}`, task });
    for (const sub of task.subtasks ?? []) {
      items.push({
        kind: "subtask",
        id: `subtask:${sub.id}`,
        subtask: sub,
        parent: task,
      });
    }
  }
  return items;
}

export function projectItemDueDate(item: ProjectItem): string | null {
  if (item.kind === "task") return item.task.due_date;
  return item.subtask.due_date;
}

export function projectItemStatus(item: ProjectItem): TaskStatus {
  if (item.kind === "task") return item.task.status;
  return (item.subtask.status ??
    (item.subtask.completed ? "done" : "todo")) as TaskStatus;
}

export function projectItemPriority(item: ProjectItem): TaskPriority {
  if (item.kind === "task") return item.task.priority;
  return item.parent.priority;
}

export function projectItemMatchesPerson(item: ProjectItem, personId: string): boolean {
  if (item.kind === "task") {
    return (
      item.task.assignee_id === personId ||
      item.task.tester_id === personId ||
      (item.task.subtasks ?? []).some(
        (s) => s.assignee_id === personId || s.tester_id === personId,
      )
    );
  }
  return (
    item.subtask.assignee_id === personId || item.subtask.tester_id === personId
  );
}

export function projectItemTitle(item: ProjectItem): string {
  return item.kind === "task" ? item.task.title : item.subtask.title;
}

/** Gantt start/end for a subtask: end = due; start = parent.start if valid else due. */
export function subtaskGanttRange(
  subtask: Subtask,
  parent: Task,
): { start: string; end: string } | null {
  if (!subtask.due_date) return null;
  const end = subtask.due_date;
  const start =
    parent.start_date && parent.start_date <= end ? parent.start_date : end;
  return { start, end };
}
