import type { Task, TaskCardDensity } from "~/types";

export type TaskCardDisplayContext = {
  showProject?: boolean;
  projectCustomerId?: string | null;
};

export function resolveProjectCustomerId(
  task: Task,
  projectCustomerId?: string | null,
): string | null | undefined {
  if (projectCustomerId !== undefined) return projectCustomerId;
  return task.projects?.customer_id ?? null;
}

/** Smart customer visibility (method 1). */
export function shouldShowCustomerSmart(
  task: Task,
  context: TaskCardDisplayContext,
): boolean {
  if (!task.customers?.name || !task.customer_id) return false;

  if (context.showProject) return true;

  const projectCustomerId = resolveProjectCustomerId(task, context.projectCustomerId);
  if (!projectCustomerId) return true;
  return task.customer_id !== projectCustomerId;
}

export function shouldShowCustomerForDensity(
  task: Task,
  density: TaskCardDensity,
  context: TaskCardDisplayContext,
): boolean {
  if (density === "compact") return false;
  if (density === "detailed") {
    return Boolean(task.customers?.name && task.customer_id);
  }
  return shouldShowCustomerSmart(task, context);
}

export type TaskCardDisplayFlags = {
  showCustomer: boolean;
  showMilestone: boolean;
  showLabels: boolean;
  showSubtaskList: boolean;
  showPeople: boolean;
};

export function taskCardDisplayFlags(
  task: Task,
  density: TaskCardDensity,
  context: TaskCardDisplayContext,
): TaskCardDisplayFlags {
  const showCustomer = shouldShowCustomerForDensity(task, density, context);

  switch (density) {
    case "compact":
      return {
        showCustomer,
        showMilestone: false,
        showLabels: false,
        showSubtaskList: false,
        showPeople: false,
      };
    case "detailed":
      return {
        showCustomer,
        showMilestone: true,
        showLabels: true,
        showSubtaskList: true,
        showPeople: true,
      };
    case "standard":
    default:
      return {
        showCustomer,
        showMilestone: true,
        showLabels: true,
        showSubtaskList: true,
        showPeople: true,
      };
  }
}

export function useTaskCardDisplay(
  task: MaybeRefOrGetter<Task>,
  context: MaybeRefOrGetter<TaskCardDisplayContext> = {},
) {
  const { taskCardDensity } = useProfile();
  const { getProject } = useProjects();

  const display = computed(() => {
    const t = toValue(task);
    const ctx = toValue(context);
    const projectCustomerId =
      ctx.projectCustomerId !== undefined
        ? ctx.projectCustomerId
        : (getProject(t.project_id)?.customer_id ?? t.projects?.customer_id ?? null);

    return taskCardDisplayFlags(t, taskCardDensity.value, {
      ...ctx,
      projectCustomerId,
    });
  });

  return { display, taskCardDensity };
}
