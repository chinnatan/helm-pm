import type { TaskPriority, TaskStatus } from "~/types";
import { TASK_PHASE_VALUES, TASK_PRIORITY_META, TASK_STATUS_VALUES } from "~/types";

export function useTaskLabels() {
  const { t } = useI18n();

  const statuses = computed(() =>
    TASK_STATUS_VALUES.map((value: TaskStatus) => ({
      value,
      label: t(`status.${value}`),
    })),
  );

  const priorities = computed(() =>
    TASK_PRIORITY_META.map((p) => ({
      value: p.value as TaskPriority,
      color: p.color,
      label: t(`priority.${p.value}`),
    })),
  );

  function statusLabel(value: TaskStatus) {
    return t(`status.${value}`);
  }

  function priorityLabel(value: TaskPriority) {
    return t(`priority.${value}`);
  }

  function priorityMeta(value: TaskPriority) {
    return (
      priorities.value.find((p) => p.value === value) ?? priorities.value[1]!
    );
  }

  const phaseFilterItems = computed(() => [
    { label: t("dashboard.allPhases"), value: "all" },
    { label: t("projects.ganttNoPhase"), value: "none" },
    ...TASK_PHASE_VALUES.map((p) => ({
      label: t(`tasks.phase.${p.value}`),
      value: p.value as string,
    })),
  ]);

  return {
    statuses,
    priorities,
    statusLabel,
    priorityLabel,
    priorityMeta,
    phaseFilterItems,
  };
}
