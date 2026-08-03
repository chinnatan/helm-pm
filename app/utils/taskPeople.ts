import type { Subtask, Task } from "~/types";

/** True if the user is assignee or tester on the parent task or any subtask. */
export function taskInvolvesUser(
  task: Pick<Task, "assignee_id" | "tester_id" | "subtasks">,
  userId: string,
): boolean {
  if (task.assignee_id === userId || task.tester_id === userId) return true;
  return (task.subtasks ?? []).some(
    (s) => s.assignee_id === userId || s.tester_id === userId,
  );
}

/** True if the user (or filter id) appears as assignee/tester on parent or any subtask. */
export function taskMatchesPerson(
  task: Pick<Task, "assignee_id" | "tester_id" | "subtasks">,
  personId: string,
): boolean {
  return taskInvolvesUser(task, personId);
}

export type CapacitySubtask = Pick<
  Subtask,
  "id" | "completed" | "assignee_id" | "estimate_hours" | "due_date"
>;

export type CapacityTaskLike = {
  assignee_id: string | null;
  priority: string;
  estimate_hours: number | null;
  start_date: string | null;
  due_date: string | null;
  subtasks?: CapacitySubtask[] | null;
};

export type CapacityHourSlice = {
  assignee_id: string;
  hours: number;
  start_date: string | null;
  due_date: string | null;
};

/**
 * Expand a task into hour slices per assignee.
 * If any incomplete subtask has an assignee, use those subtasks' estimates/dues
 * (parent hours are not double-counted). Otherwise attribute parent hours to parent assignee.
 */
export function capacitySlicesForTask(
  task: CapacityTaskLike,
  effectiveHours: (input: {
    estimate_hours?: number | null;
    priority: string;
  }) => number,
): CapacityHourSlice[] {
  const assignedSubs = (task.subtasks ?? []).filter(
    (s) => !s.completed && s.assignee_id,
  );

  if (assignedSubs.length > 0) {
    return assignedSubs.map((s) => ({
      assignee_id: s.assignee_id!,
      hours: effectiveHours({
        estimate_hours: s.estimate_hours,
        priority: task.priority,
      }),
      start_date: task.start_date,
      due_date: s.due_date ?? task.due_date,
    }));
  }

  if (!task.assignee_id) return [];

  return [
    {
      assignee_id: task.assignee_id,
      hours: effectiveHours({
        estimate_hours: task.estimate_hours,
        priority: task.priority,
      }),
      start_date: task.start_date,
      due_date: task.due_date,
    },
  ];
}
