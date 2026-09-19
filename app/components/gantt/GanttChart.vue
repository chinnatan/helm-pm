<script setup lang="ts">
import type {
  Milestone,
  Subtask,
  Task,
  TaskPhase,
  TaskStatus,
} from "~/types";
import { isTaskClosed, TASK_PHASE_VALUES, taskPhaseMeta } from "~/types";
import Gantt from "frappe-gantt";
import "frappe-gantt/dist/frappe-gantt.css";
import { format, parseISO, addDays, isSameMonth, isSameYear } from "date-fns";
import { subtaskGanttRange } from "~/utils/projectItems";

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
  "update-subtask-dates": [subtaskId: string, startDate: string, endDate: string];
  "task-click": [task: Task];
  "subtask-click": [payload: { subtask: Subtask; parent: Task }];
  "milestone-click": [milestone: Milestone];
}>();

/** Must match frappe-gantt options used below */
const BAR_HEIGHT = 28;
const ROW_PADDING = 18;
const ROW_HEIGHT = BAR_HEIGHT + ROW_PADDING;
const UPPER_HEADER = 45;
const LOWER_HEADER = 30;
const HEADER_HEIGHT = UPPER_HEADER + LOWER_HEADER + 10;

const GROUP_PREFIX = "grp-";
const SUB_PREFIX = "sub-";
const UNGROUPED_ID = "__ungrouped__";

const containerRef = ref<HTMLElement | null>(null);
const leftScrollRef = ref<HTMLElement | null>(null);
const rightScrollRef = ref<HTMLElement | null>(null);
let ganttInstance: InstanceType<typeof Gantt> | null = null;
let mobileMq: MediaQueryList | null = null;
let syncingScroll = false;

const collapsed = ref<Record<string, boolean>>({});

type GroupBy = "milestone" | "phase" | "none";
const groupBy = ref<GroupBy>("milestone");

const groupByItems = computed(() => [
  { label: t("projects.ganttGroupMilestone"), value: "milestone" as GroupBy },
  { label: t("projects.ganttGroupPhase"), value: "phase" as GroupBy },
  { label: t("projects.ganttGroupNone"), value: "none" as GroupBy },
]);

type TimelineRow =
  | {
      kind: "group";
      id: string;
      milestone: Milestone | null;
      phase: TaskPhase | null;
      title: string;
      start: string;
      end: string;
      taskCount: number;
      doneCount: number;
    }
  | {
      kind: "task";
      id: string;
      task: Task;
      start: string;
      end: string;
    }
  | {
      kind: "subtask";
      id: string;
      subtask: Subtask;
      parent: Task;
      start: string;
      end: string;
    };

interface GanttGroup {
  id: string;
  milestone: Milestone | null;
  phase: TaskPhase | null;
  title: string;
  start: string;
  end: string;
  tasks: Task[];
}

function datedSubtasksFor(task: Task) {
  return (task.subtasks ?? [])
    .map((sub) => {
      const range = subtaskGanttRange(sub, task);
      if (!range) return null;
      return { sub, ...range };
    })
    .filter(Boolean) as { sub: Subtask; start: string; end: string }[];
}

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

const parentsWithDatedSubs = computed(() =>
  props.tasks.filter(
    (t) =>
      !datedTasks.value.some((d) => d.id === t.id) &&
      datedSubtasksFor(t).length > 0,
  ),
);

function byStartDate(a: Task, b: Task) {
  return (a.start_date || a.due_date || "").localeCompare(
    b.start_date || b.due_date || "",
  );
}

function groupRangeOf(tasksIn: Task[]) {
  let start = "";
  let end = "";
  for (const t of tasksIn) {
    if (t.start_date || t.due_date) {
      const d = taskDates(t);
      if (!start || d.start < start) start = d.start;
      if (!end || d.end > end) end = d.end;
    }
    for (const s of datedSubtasksFor(t)) {
      if (!start || s.start < start) start = s.start;
      if (!end || s.end > end) end = s.end;
    }
  }
  return { start, end };
}

const groups = computed<GanttGroup[]>(() => {
  if (groupBy.value === "phase") {
    const all = [...datedTasks.value, ...parentsWithDatedSubs.value];
    const out: GanttGroup[] = [];
    for (const pv of TASK_PHASE_VALUES) {
      const children = all
        .filter((t) => (t.phase ?? null) === pv.value)
        .sort(byStartDate);
      if (children.length === 0) continue;
      const { start, end } = groupRangeOf(children);
      out.push({
        id: `phase-${pv.value}`,
        milestone: null,
        phase: pv.value,
        title: t(`tasks.phase.${pv.value}`),
        start,
        end,
        tasks: children,
      });
    }
    const noPhase = all.filter((t) => !t.phase).sort(byStartDate);
    if (noPhase.length > 0) {
      const { start, end } = groupRangeOf(noPhase);
      out.push({
        id: UNGROUPED_ID,
        milestone: null,
        phase: null,
        title: t("projects.ganttNoPhase"),
        start,
        end,
        tasks: noPhase,
      });
    }
    return out;
  }

  if (groupBy.value === "none") return [];

  const milestones = [...(props.milestones ?? [])].sort((a, b) =>
    (a.start_date || a.date).localeCompare(b.start_date || b.date),
  );
  const assigned = new Set<string>();
  const out: GanttGroup[] = [];

  for (const ms of milestones) {
    const children = datedTasks.value
      .filter((t) => t.milestone_id === ms.id)
      .sort(byStartDate);
    for (const t of children) assigned.add(t.id);
    const dates = milestoneDates(ms);
    out.push({
      id: ms.id,
      milestone: ms,
      phase: null,
      title: ms.title,
      start: dates.start,
      end: dates.end,
      tasks: children,
    });
  }

  const ungroupedAll = [
    ...datedTasks.value.filter((t) => !assigned.has(t.id)).sort(byStartDate),
    ...parentsWithDatedSubs.value.filter((t) => !assigned.has(t.id)),
  ];

  if (ungroupedAll.length > 0 || milestones.length === 0) {
    const { start, end } = groupRangeOf(ungroupedAll);
    if (ungroupedAll.length > 0) {
      out.push({
        id: UNGROUPED_ID,
        milestone: null,
        phase: null,
        title: t("projects.ganttNoMilestone"),
        start,
        end,
        tasks: ungroupedAll,
      });
    }
  }

  return out;
});

const visibleRows = computed<TimelineRow[]>(() => {
  const rows: TimelineRow[] = [];

  function pushTaskRows(tasksIn: Task[]) {
    for (const task of tasksIn) {
      if (task.start_date || task.due_date) {
        const d = taskDates(task);
        rows.push({ kind: "task", id: task.id, task, start: d.start, end: d.end });
      }
      for (const { sub, start, end } of datedSubtasksFor(task)) {
        rows.push({
          kind: "subtask",
          id: `${SUB_PREFIX}${sub.id}`,
          subtask: sub,
          parent: task,
          start,
          end,
        });
      }
    }
  }

  if (groupBy.value === "none") {
    pushTaskRows(
      [...datedTasks.value, ...parentsWithDatedSubs.value].sort(byStartDate),
    );
    return rows;
  }

  for (const group of groups.value) {
    rows.push({
      kind: "group",
      id: group.id,
      milestone: group.milestone,
      phase: group.phase,
      title: group.title,
      start: group.start,
      end: group.end,
      taskCount: group.tasks.length,
      doneCount: group.tasks.filter(
        (t) => t.status === "done" || t.status === "release",
      ).length,
    });
    if (collapsed.value[group.id]) continue;
    pushTaskRows(group.tasks);
  }
  return rows;
});

const hasTimelineItems = computed(() => visibleRows.value.length > 0);

const PRIORITY_BAR_COLOR: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#94a3b8",
};

function buildGanttData() {
  return visibleRows.value.map((row) => {
    if (row.kind === "group") {
      // frappe 1.0.3 does classList.add(custom_class) — multi-token strings throw
      const band =
        row.phase || groupBy.value === "phase"
          ? {
              custom_class: "phase-bar",
              color: taskPhaseMeta(row.phase)?.color ?? "#94a3b8",
            }
          : { custom_class: "milestone-bar", color: "#0b6e7a" };
      // a same-day group would render a 0-width (invisible) band — guarantee ≥ 1 column
      const start = row.start || format(new Date(), "yyyy-MM-dd");
      let end = row.end;
      if (!end || end <= start) {
        end = format(addDays(parseISO(start), 1), "yyyy-MM-dd");
      }
      return {
        id: `${GROUP_PREFIX}${row.id}`,
        name: " ",
        start,
        end,
        progress: 100,
        dependencies: "",
        ...band,
      };
    }
    if (row.kind === "subtask") {
      const status = (row.subtask.status ??
        (row.subtask.completed ? "done" : "todo")) as string;
      return {
        id: row.id,
        name: " ",
        start: row.start,
        end: row.end,
        progress: statusToProgress(status),
        dependencies: "",
        custom_class: "gantt-subtask",
        color: PRIORITY_BAR_COLOR[row.parent.priority],
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

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

function depChipLine(taskId: string) {
  const dep = props.tasks.find((t) => t.id === taskId);
  if (!dep) return "";
  return `<div>${isTaskClosed(dep.status) ? "✅" : "⏳"} ${esc(dep.title)}</div>`;
}

function popupHtml(id: string): string | false {
  if (id.startsWith(GROUP_PREFIX)) {
    const group = groups.value.find((g) => g.id === id.slice(GROUP_PREFIX.length));
    if (!group) return false;
    const done = group.tasks.filter(
      (t) => t.status === "done" || t.status === "release",
    ).length;
    return `<div class="title">${esc(group.title)}</div><div class="details">${done}/${group.tasks.length} ${esc(t("projects.ganttTasksCount"))}<br>${esc(formatRange(group.start, group.end))}</div>`;
  }
  if (id.startsWith(SUB_PREFIX)) {
    const subId = id.slice(SUB_PREFIX.length);
    for (const parent of props.tasks) {
      const sub = parent.subtasks?.find((s) => s.id === subId);
      if (!sub) continue;
      const range = subtaskGanttRange(sub, parent);
      const status = (sub.status ?? (sub.completed ? "done" : "todo")) as TaskStatus;
      return `<div class="title">${esc(sub.title)}</div><div class="subtitle">${esc(t("tasks.subtaskOf", { title: parent.title }))}</div><div class="details">${esc(statusLabel(status))}${range ? ` · ${esc(formatRange(range.start, range.end))}` : ""}</div>`;
    }
    return false;
  }
  const task = props.tasks.find((t) => t.id === id);
  if (!task) return false;
  const depends = (props.dependencies ?? [])
    .filter((d) => d.task_id === task.id)
    .map((d) => depChipLine(d.depends_on_task_id))
    .join("");
  const blocks = (props.dependencies ?? [])
    .filter((d) => d.depends_on_task_id === task.id)
    .map((d) => depChipLine(d.task_id))
    .join("");
  const range = taskDates(task);
  return `<div class="title">${esc(task.title)}</div><div class="subtitle">${esc(statusLabel(task.status))} · ${esc(formatRange(range.start, range.end))}</div><div class="details">${depends ? `<b>${esc(t("tasks.dependsOn"))}</b>${depends}` : ""}${blocks ? `<br><b>${esc(t("tasks.blocks"))}</b>${blocks}` : ""}${!depends && !blocks ? esc(t("tasks.noDependencies")) : ""}</div>`;
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
    popup: ({ task }: { task: { id: string } }) => popupHtml(task.id),
    on_date_change: (task: { id: string; start: string; end: string }) => {
      if (task.id.startsWith(GROUP_PREFIX)) return;
      if (task.id.startsWith(SUB_PREFIX)) {
        emit(
          "update-subtask-dates",
          task.id.slice(SUB_PREFIX.length),
          task.start,
          task.end,
        );
        return;
      }
      emit("update-dates", task.id, task.start, task.end);
    },
    on_click: (task: { id: string }) => {
      if (task.id.startsWith(GROUP_PREFIX)) {
        const groupId = task.id.slice(GROUP_PREFIX.length);
        if (groupId === UNGROUPED_ID) return;
        const group = groups.value.find((g) => g.id === groupId);
        if (group?.phase) {
          toggleGroup(groupId);
          return;
        }
        const found = group?.milestone ?? props.milestones?.find((m) => m.id === groupId);
        if (found) emit("milestone-click", found);
        return;
      }
      if (task.id.startsWith(SUB_PREFIX)) {
        const subId = task.id.slice(SUB_PREFIX.length);
        for (const parent of props.tasks) {
          const sub = parent.subtasks?.find((s) => s.id === subId);
          if (sub) {
            emit("subtask-click", { subtask: sub, parent });
            return;
          }
        }
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
  if (row.kind === "group") {
    if (row.milestone) emit("milestone-click", row.milestone);
    return;
  }
  if (row.kind === "subtask") {
    emit("subtask-click", { subtask: row.subtask, parent: row.parent });
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
  () => [props.tasks, props.dependencies, props.milestones, collapsed.value, groupBy.value],
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

  <div v-else class="flex min-h-0 flex-1 flex-col">
    <div class="mb-3 flex shrink-0 items-center justify-end gap-2">
      <span class="text-xs font-medium text-slate-500">{{ t("projects.ganttGroupBy") }}</span>
      <USelect v-model="groupBy" :items="groupByItems" size="sm" class="w-48" />
    </div>

    <div class="gantt-shell flex min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
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
        <template v-if="row.kind === 'group'">
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
            <UIcon
              v-if="row.phase && taskPhaseMeta(row.phase)"
              :name="taskPhaseMeta(row.phase)!.icon"
              class="h-4 w-4 shrink-0"
              :style="{ color: taskPhaseMeta(row.phase)!.color }"
            />
            <UIcon v-else name="i-lucide-flag" class="h-3.5 w-3.5 shrink-0 text-ocean-700" />
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-slate-900">{{ row.title }}</p>
              <p v-if="row.taskCount" class="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span class="inline-block h-1 w-16 shrink-0 overflow-hidden rounded-full bg-slate-200 align-middle">
                  <span
                    class="block h-full rounded-full bg-emerald-500"
                    :style="{ width: `${Math.round((row.doneCount / row.taskCount) * 100)}%` }"
                  />
                </span>
                {{ row.doneCount }}/{{ row.taskCount }}
              </p>
              <p v-else class="truncate text-[10px] text-slate-400">
                {{ row.taskCount }} {{ t("projects.ganttTasksCount") }}
              </p>
            </div>
          </div>
          <div class="flex items-center justify-center">
            <span
              v-if="row.milestone?.status"
              class="text-[10px] font-medium uppercase tracking-wide text-ocean-800"
            >
              {{ t(`projects.milestoneStatus.${row.milestone.status}`) }}
            </span>
            <span
              v-else-if="!row.phase && groupBy === 'milestone'"
              class="text-[10px] font-medium uppercase tracking-wide text-ocean-800"
            >
              {{ t("projects.milestone") }}
            </span>
          </div>
          <div class="flex items-center justify-end text-right text-[11px] text-slate-500">
            {{ row.start ? formatRange(row.start, row.end) : "" }}
          </div>
        </template>

        <template v-else-if="row.kind === 'subtask'">
          <div class="flex min-w-0 items-center gap-1.5 pl-12">
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              :class="
                statusDotClass(
                  (row.subtask.status ??
                    (row.subtask.completed ? 'done' : 'todo')) as TaskStatus,
                )
              "
            />
            <div class="min-w-0">
              <p class="truncate text-sm text-slate-600">{{ row.subtask.title }}</p>
              <p class="truncate text-[10px] text-slate-400">
                {{ t("tasks.subtaskOf", { title: row.parent.title }) }}
              </p>
            </div>
          </div>
          <div class="flex items-center justify-center">
            <span class="truncate text-[10px] text-slate-500">
              {{
                statusLabel(
                  (row.subtask.status ??
                    (row.subtask.completed ? "done" : "todo")) as TaskStatus,
                )
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
  </div>
</template>

<style>
.gantt-side {
  width: min(340px, 42vw);
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

/* Milestone = thin summary bar (height comes from custom_bar_height) */
.gantt-shell .gantt-container .bar-wrapper.milestone-bar .bar {
  fill: #0b6e7a;
  opacity: 0.85;
}
.gantt-shell .gantt-container .bar-wrapper.milestone-bar .bar-progress {
  display: none;
}
.gantt-shell .gantt-container .bar-wrapper.milestone-bar .handle {
  display: none;
}

.gantt-shell .gantt-container .bar-wrapper.gantt-subtask .bar {
  opacity: 0.75;
  stroke: #fff;
  stroke-width: 1;
  stroke-dasharray: 3 2;
}

/* Phase swim-lane bands (color set inline via task.color — custom_class must stay single-token) */
.gantt-shell .gantt-container .bar-wrapper.phase-bar .bar {
  opacity: 0.6;
}
.gantt-shell .gantt-container .bar-wrapper.phase-bar .bar-progress {
  display: none;
}
.gantt-shell .gantt-container .bar-wrapper.phase-bar .handle {
  display: none;
}

.gantt-shell .gantt-container .bar-wrapper {
  cursor: pointer;
}
</style>
