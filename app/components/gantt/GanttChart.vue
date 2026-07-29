<script setup lang="ts">
import type { Milestone, Task, TaskStatus } from "~/types";
import Gantt from "frappe-gantt";
import "frappe-gantt/dist/frappe-gantt.css";
import { format, parseISO, addDays, isSameMonth, isSameYear } from "date-fns";

const props = defineProps<{
  tasks: Task[];
  milestones?: Milestone[];
  dependencies?: { task_id: string; depends_on_task_id: string }[];
}>();

const { t } = useI18n();
const { dateFnsLocale } = useDateLocale();
const { statusLabel } = useTaskLabels();

const emit = defineEmits<{
  "update-dates": [taskId: string, startDate: string, endDate: string];
  "task-click": [task: Task];
  "milestone-click": [milestone: Milestone];
}>();

/** Must match frappe-gantt options used below */
const BAR_HEIGHT = 28;
const ROW_PADDING = 18;
const ROW_HEIGHT = BAR_HEIGHT + ROW_PADDING;
const UPPER_HEADER = 45;
const LOWER_HEADER = 30;
const HEADER_HEIGHT = UPPER_HEADER + LOWER_HEADER + 10;

const MS_PREFIX = "ms-";
const UNGROUPED_ID = "__ungrouped__";

const containerRef = ref<HTMLElement | null>(null);
const leftScrollRef = ref<HTMLElement | null>(null);
const rightScrollRef = ref<HTMLElement | null>(null);
let ganttInstance: InstanceType<typeof Gantt> | null = null;
let mobileMq: MediaQueryList | null = null;
let syncingScroll = false;

const collapsed = ref<Record<string, boolean>>({});

type TimelineRow =
  | {
      kind: "milestone";
      id: string;
      milestone: Milestone | null;
      title: string;
      start: string;
      end: string;
      taskCount: number;
    }
  | {
      kind: "task";
      id: string;
      task: Task;
      milestoneId: string;
      start: string;
      end: string;
    };

function taskDates(task: Task) {
  const start = task.start_date || task.due_date!;
  const end =
    task.due_date || format(addDays(parseISO(start), 1), "yyyy-MM-dd");
  return { start, end: end < start ? start : end };
}

function milestoneDates(ms: Milestone) {
  const start = ms.start_date || ms.date;
  const end = ms.due_date || ms.date || start;
  return { start, end: end < start ? start : end };
}

function formatRange(start: string, end: string) {
  try {
    const s = parseISO(start);
    const e = parseISO(end);
    if (isSameYear(s, e) && isSameMonth(s, e)) {
      if (format(s, "yyyy-MM-dd") === format(e, "yyyy-MM-dd")) {
        return format(s, "d MMM", { locale: dateFnsLocale.value });
      }
      return `${format(s, "d", { locale: dateFnsLocale.value })} – ${format(e, "d MMM", { locale: dateFnsLocale.value })}`;
    }
    return `${format(s, "d MMM", { locale: dateFnsLocale.value })} – ${format(e, "d MMM", { locale: dateFnsLocale.value })}`;
  } catch {
    return `${start} → ${end}`;
  }
}

function statusDotClass(status: TaskStatus) {
  switch (status) {
    case "done":
    case "release":
      return "bg-emerald-500";
    case "testing":
    case "ready_for_test":
      return "bg-amber-500";
    case "in_progress":
      return "bg-sky-500";
    case "cancelled":
      return "bg-slate-400";
    case "backlog":
      return "bg-slate-300";
    default:
      return "bg-slate-300";
  }
}

function statusToProgress(status: string) {
  if (status === "done" || status === "release") return 100;
  if (status === "testing") return 80;
  if (status === "ready_for_test") return 65;
  if (status === "in_progress") return 40;
  if (status === "cancelled" || status === "backlog") return 0;
  return 0;
}

function viewMode() {
  return mobileMq?.matches ? "Month" : "Week";
}

const datedTasks = computed(() =>
  props.tasks.filter((t) => t.start_date || t.due_date),
);

const timelineGroups = computed(() => {
  const milestones = [...(props.milestones ?? [])].sort((a, b) =>
    (a.start_date || a.date).localeCompare(b.start_date || b.date),
  );
  const assigned = new Set<string>();

  const groups: {
    id: string;
    milestone: Milestone | null;
    title: string;
    start: string;
    end: string;
    tasks: Task[];
  }[] = [];

  for (const ms of milestones) {
    const children = datedTasks.value
      .filter((t) => t.milestone_id === ms.id)
      .sort((a, b) =>
        (a.start_date || a.due_date || "").localeCompare(
          b.start_date || b.due_date || "",
        ),
      );
    for (const t of children) assigned.add(t.id);
    const dates = milestoneDates(ms);
    groups.push({
      id: ms.id,
      milestone: ms,
      title: ms.title,
      start: dates.start,
      end: dates.end,
      tasks: children,
    });
  }

  const ungrouped = datedTasks.value
    .filter((t) => !assigned.has(t.id))
    .sort((a, b) =>
      (a.start_date || a.due_date || "").localeCompare(
        b.start_date || b.due_date || "",
      ),
    );

  if (ungrouped.length > 0 || milestones.length === 0) {
    let start = "";
    let end = "";
    for (const t of ungrouped) {
      const d = taskDates(t);
      if (!start || d.start < start) start = d.start;
      if (!end || d.end > end) end = d.end;
    }
    if (ungrouped.length > 0) {
      groups.push({
        id: UNGROUPED_ID,
        milestone: null,
        title: t("projects.ganttNoMilestone"),
        start,
        end,
        tasks: ungrouped,
      });
    }
  }

  return groups;
});

const visibleRows = computed<TimelineRow[]>(() => {
  const rows: TimelineRow[] = [];
  for (const group of timelineGroups.value) {
    rows.push({
      kind: "milestone",
      id: group.id,
      milestone: group.milestone,
      title: group.title,
      start: group.start,
      end: group.end,
      taskCount: group.tasks.length,
    });
    if (collapsed.value[group.id]) continue;
    for (const task of group.tasks) {
      const d = taskDates(task);
      rows.push({
        kind: "task",
        id: task.id,
        task,
        milestoneId: group.id,
        start: d.start,
        end: d.end,
      });
    }
  }
  return rows;
});

const hasTimelineItems = computed(() => visibleRows.value.length > 0);

function buildGanttData() {
  return visibleRows.value.map((row) => {
    if (row.kind === "milestone") {
      return {
        id: `${MS_PREFIX}${row.id}`,
        name: " ",
        start: row.start,
        end: row.end,
        progress: 100,
        dependencies: "",
        custom_class: "milestone-bar",
      };
    }
    return {
      id: row.id,
      name: " ",
      start: row.start,
      end: row.end,
      progress: statusToProgress(row.task.status),
      dependencies: (props.dependencies ?? [])
        .filter((d) => d.task_id === row.id)
        .map((d) => d.depends_on_task_id)
        .join(","),
      custom_class: `priority-${row.task.priority}`,
    };
  });
}

function renderGantt() {
  if (!containerRef.value) return;
  containerRef.value.innerHTML = "";
  ganttInstance = null;

  const data = buildGanttData();
  if (data.length === 0) return;

  ganttInstance = new Gantt(containerRef.value, data, {
    view_mode: viewMode(),
    bar_height: BAR_HEIGHT,
    padding: ROW_PADDING,
    upper_header_height: UPPER_HEADER,
    lower_header_height: LOWER_HEADER,
    infinite_padding: false,
    today_button: true,
    view_mode_select: true,
    popup_on: "hover",
    on_date_change: (task: { id: string; start: string; end: string }) => {
      if (task.id.startsWith(MS_PREFIX)) return;
      emit("update-dates", task.id, task.start, task.end);
    },
    on_click: (task: { id: string }) => {
      if (task.id.startsWith(MS_PREFIX)) {
        const msId = task.id.slice(MS_PREFIX.length);
        if (msId === UNGROUPED_ID) return;
        const found = props.milestones?.find((m) => m.id === msId);
        if (found) emit("milestone-click", found);
        return;
      }
      const found = props.tasks.find((t) => t.id === task.id);
      if (found) emit("task-click", found);
    },
  } as ConstructorParameters<typeof Gantt>[2]);
}

function toggleGroup(groupId: string) {
  collapsed.value = {
    ...collapsed.value,
    [groupId]: !collapsed.value[groupId],
  };
}

function onRowClick(row: TimelineRow) {
  if (row.kind === "milestone") {
    if (row.milestone) emit("milestone-click", row.milestone);
    return;
  }
  emit("task-click", row.task);
}

function syncScroll(source: "left" | "right") {
  if (syncingScroll) return;
  const left = leftScrollRef.value;
  const right = rightScrollRef.value;
  if (!left || !right) return;
  syncingScroll = true;
  if (source === "left") right.scrollTop = left.scrollTop;
  else left.scrollTop = right.scrollTop;
  requestAnimationFrame(() => {
    syncingScroll = false;
  });
}

watch(
  () => [props.tasks, props.dependencies, props.milestones, collapsed.value],
  () => nextTick(renderGantt),
  { deep: true },
);

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
  <div
    v-if="!hasTimelineItems"
    class="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 sm:p-12"
  >
    <UIcon name="i-lucide-gantt-chart" class="mx-auto mb-3 h-10 w-10 text-slate-300" />
    <p>{{ t("projects.ganttEmpty") }}</p>
  </div>

  <div
    v-else
    class="gantt-shell flex overflow-hidden rounded-xl border border-slate-200 bg-white"
  >
    <!-- Left: hierarchical milestone / task list -->
    <aside
      ref="leftScrollRef"
      class="gantt-side shrink-0 overflow-y-auto border-r border-slate-200 bg-white"
      @scroll="syncScroll('left')"
    >
      <div
        class="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_72px_88px] gap-2 border-b border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
        :style="{ height: `${HEADER_HEIGHT}px` }"
      >
        <span class="flex items-end pb-2">{{ t("projects.ganttColWork") }}</span>
        <span class="flex items-end justify-center pb-2">{{ t("projects.ganttColStatus") }}</span>
        <span class="flex items-end justify-end pb-2">{{ t("projects.ganttColDates") }}</span>
      </div>

      <div
        v-for="row in visibleRows"
        :key="`${row.kind}-${row.id}`"
        class="grid cursor-pointer grid-cols-[minmax(0,1fr)_72px_88px] gap-2 border-b border-slate-100 px-3 transition-colors hover:bg-ocean-50/60"
        :style="{ height: `${ROW_HEIGHT}px` }"
        @click="onRowClick(row)"
      >
        <template v-if="row.kind === 'milestone'">
          <div class="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
              :aria-label="t('projects.ganttToggleGroup')"
              @click.stop="toggleGroup(row.id)"
            >
              <UIcon
                :name="collapsed[row.id] ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
                class="h-3.5 w-3.5"
              />
            </button>
            <UIcon name="i-lucide-flag" class="h-3.5 w-3.5 shrink-0 text-ocean-700" />
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-slate-900">{{ row.title }}</p>
              <p class="truncate text-[10px] text-slate-400">
                {{ row.taskCount }} {{ t("projects.ganttTasksCount") }}
              </p>
            </div>
          </div>
          <div class="flex items-center justify-center">
            <span class="text-[10px] font-medium uppercase tracking-wide text-ocean-800">
              {{
                row.milestone?.status
                  ? t(`projects.milestoneStatus.${row.milestone.status}`)
                  : t("projects.milestone")
              }}
            </span>
          </div>
          <div class="flex items-center justify-end text-right text-[11px] text-slate-500">
            {{ formatRange(row.start, row.end) }}
          </div>
        </template>

        <template v-else>
          <div class="flex min-w-0 items-center gap-1.5 pl-7">
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              :class="statusDotClass(row.task.status)"
            />
            <p class="truncate text-sm text-slate-700">{{ row.task.title }}</p>
          </div>
          <div class="flex items-center justify-center">
            <span class="truncate text-[10px] text-slate-500">
              {{ statusLabel(row.task.status) }}
            </span>
          </div>
          <div class="flex items-center justify-end text-right text-[11px] text-slate-500">
            {{ formatRange(row.start, row.end) }}
          </div>
        </template>
      </div>
    </aside>

    <!-- Right: frappe timeline -->
    <div
      ref="rightScrollRef"
      class="gantt-timeline min-w-0 flex-1 overflow-auto"
      @scroll="syncScroll('right')"
    >
      <div ref="containerRef" />
    </div>
  </div>
</template>

<style>
.gantt-side {
  width: min(340px, 42vw);
  max-height: min(70vh, 720px);
}

.gantt-timeline {
  max-height: min(70vh, 720px);
}

.gantt-shell .gantt-container {
  overflow: visible !important;
  height: auto !important;
  border-radius: 0;
  line-height: 14.5px;
}

.gantt-shell .gantt-container .bar-label {
  display: none;
}

.gantt-shell .gantt-container .bar-wrapper.priority-urgent .bar {
  fill: #ef4444;
}
.gantt-shell .gantt-container .bar-wrapper.priority-high .bar {
  fill: #f59e0b;
}
.gantt-shell .gantt-container .bar-wrapper.priority-medium .bar {
  fill: #3b82f6;
}
.gantt-shell .gantt-container .bar-wrapper.priority-low .bar {
  fill: #94a3b8;
}

/* Milestone = thin summary / bracket-style bar */
.gantt-shell .gantt-container .bar-wrapper.milestone-bar .bar {
  fill: #0b6e7a;
  opacity: 0.85;
  height: 10px !important;
  transform: translateY(9px);
}
.gantt-shell .gantt-container .bar-wrapper.milestone-bar .bar-progress {
  display: none;
}
.gantt-shell .gantt-container .bar-wrapper.milestone-bar .handle {
  display: none;
}

.gantt-shell .gantt-container .bar-wrapper {
  cursor: pointer;
}
</style>
