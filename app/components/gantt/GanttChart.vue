<script setup lang="ts">
import type { Task } from "~/types";
import Gantt from "frappe-gantt";
import "frappe-gantt/dist/frappe-gantt.css";
import { format, parseISO, addDays } from "date-fns";

const props = defineProps<{
  tasks: Task[];
  milestones?: { id: string; title: string; date: string }[];
  dependencies?: { task_id: string; depends_on_task_id: string }[];
}>();

const { t } = useI18n();

const emit = defineEmits<{
  "update-dates": [taskId: string, startDate: string, endDate: string];
  "task-click": [task: Task];
  "milestone-click": [milestone: { id: string; title: string; date: string }];
}>();

const containerRef = ref<HTMLElement | null>(null);
let ganttInstance: InstanceType<typeof Gantt> | null = null;
let mobileMq: MediaQueryList | null = null;

function statusToProgress(status: string) {
  if (status === "done" || status === "release") return 100;
  if (status === "testing") return 80;
  if (status === "ready_for_test") return 65;
  if (status === "in_progress") return 40;
  if (status === "cancelled") return 0;
  return 0;
}

function viewMode() {
  return mobileMq?.matches ? "Month" : "Week";
}

function buildGanttData() {
  return props.tasks
    .filter((t) => t.start_date || t.due_date)
    .map((t) => {
      const start = t.start_date || t.due_date!;
      const end = t.due_date || format(addDays(parseISO(start), 1), "yyyy-MM-dd");
      return {
        id: t.id,
        name: t.title,
        start,
        end,
        progress: statusToProgress(t.status),
        dependencies: (props.dependencies ?? [])
          .filter((d) => d.task_id === t.id)
          .map((d) => d.depends_on_task_id)
          .join(","),
        custom_class: `priority-${t.priority}`,
      };
    });
}

function renderGantt() {
  if (!containerRef.value) return;

  containerRef.value.innerHTML = "";

  const data = buildGanttData();
  if (data.length === 0) return;

  ganttInstance = new Gantt(containerRef.value, data, {
    view_mode: viewMode(),
    bar_height: 28,
    padding: 18,
    on_date_change: (task: { id: string; start: string; end: string }) => {
      emit("update-dates", task.id, task.start, task.end);
    },
    on_click: (task: { id: string }) => {
      const found = props.tasks.find((t) => t.id === task.id);
      if (found) emit("task-click", found);
    },
  } as ConstructorParameters<typeof Gantt>[2]);
}

watch(() => [props.tasks, props.dependencies, props.milestones], renderGantt, { deep: true });

onMounted(() => {
  mobileMq = window.matchMedia("(max-width: 767px)");
  mobileMq.addEventListener("change", renderGantt);
  renderGantt();
});

onUnmounted(() => {
  mobileMq?.removeEventListener("change", renderGantt);
  mobileMq = null;
  ganttInstance = null;
});
</script>

<template>
  <div>
    <div v-if="milestones?.length" class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="ms in milestones"
        :key="ms.id"
        type="button"
        class="cursor-pointer"
        @click="emit('milestone-click', ms)"
      >
        <UBadge color="warning" variant="subtle" class="hover:ring-1 hover:ring-amber-300">
          {{ ms.title }} — {{ ms.date }}
        </UBadge>
      </button>
    </div>

    <div
      v-if="tasks.filter((t) => t.start_date || t.due_date).length === 0"
      class="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 sm:p-12"
    >
      <UIcon name="i-lucide-gantt-chart" class="mx-auto mb-3 h-10 w-10 text-slate-300" />
      <p>{{ t("projects.ganttEmpty") }}</p>
    </div>

    <div ref="containerRef" class="gantt-container overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 sm:p-4" />
  </div>
</template>

<style>
.gantt-container .bar-wrapper.priority-urgent .bar { fill: #ef4444; }
.gantt-container .bar-wrapper.priority-high .bar { fill: #f59e0b; }
.gantt-container .bar-wrapper.priority-medium .bar { fill: #3b82f6; }
.gantt-container .bar-wrapper.priority-low .bar { fill: #94a3b8; }
.gantt-container .bar-wrapper { cursor: pointer; }
</style>
