import type { Task, TaskCardDensity } from "~/types";

export type TaskCardDisplayContext = {
  /** หน้าที่กรองตามลูกค้าอยู่แล้ว — ไม่ต้องแสดงชื่อลูกค้าซ้ำใน density standard */
  scopedCustomerId?: string | null;
};

export function shouldShowCustomerForDensity(
  task: Task,
  density: TaskCardDensity,
  context: TaskCardDisplayContext,
): boolean {
  if (density === "compact") return false;
  if (!task.customers?.name || !task.customer_id) return false;
  if (density === "detailed") return true;
  return task.customer_id !== context.scopedCustomerId;
}

export type TaskCardDisplayFlags = {
  showCustomer: boolean;
  showFeature: boolean;
  showLabels: boolean;
  showSubtaskList: boolean;
  showPeople: boolean;
};

export function taskCardDisplayFlags(
  task: Task,
  density: TaskCardDensity,
  context: TaskCardDisplayContext,
): TaskCardDisplayFlags {
  const compact = density === "compact";
  return {
    showCustomer: shouldShowCustomerForDensity(task, density, context),
    showFeature: !compact,
    showLabels: !compact,
    showSubtaskList: !compact,
    showPeople: !compact,
  };
}

export function useTaskCardDisplay(
  task: MaybeRefOrGetter<Task>,
  context: MaybeRefOrGetter<TaskCardDisplayContext> = {},
) {
  const { taskCardDensity } = useProfile();

  const display = computed(() =>
    taskCardDisplayFlags(toValue(task), taskCardDensity.value, toValue(context)),
  );

  return { display, taskCardDensity };
}
