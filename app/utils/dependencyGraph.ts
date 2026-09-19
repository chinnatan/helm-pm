import type { Task, TaskDependency } from "~/types";
import { isTaskClosed } from "~/types";

/**
 * Pure dependency-graph logic, extracted from useDependencyGraph() so it can be
 * unit-tested without Vue reactivity.
 */

// BFS: adding `taskId` depends on `dependsOnTaskId` creates a cycle if
// `dependsOnTaskId` already (transitively) depends on `taskId`.
// ponytail: O(V+E) scan per check, fine for project-sized graphs — revisit if a project hits thousands of deps.
export function graphWouldCreateCycle(
  deps: TaskDependency[],
  taskId: string,
  dependsOnTaskId: string,
): boolean {
  if (taskId === dependsOnTaskId) return true;
  const queue = [dependsOnTaskId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    if (cur === taskId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const d of deps) {
      if (d.task_id === cur) queue.push(d.depends_on_task_id);
    }
  }
  return false;
}

// list of open prerequisite tasks currently blocking `taskId`
export function graphBlockedBy(
  deps: TaskDependency[],
  taskById: Map<string, Task>,
  taskId: string,
): Task[] {
  return deps
    .filter((d) => d.task_id === taskId)
    .map((d) => taskById.get(d.depends_on_task_id))
    .filter((t): t is Task => !!t && !isTaskClosed(t.status));
}

export function graphIsBlocked(
  deps: TaskDependency[],
  taskById: Map<string, Task>,
  taskId: string,
): boolean {
  return graphBlockedBy(deps, taskById, taskId).length > 0;
}
