<script setup lang="ts">
import type { Subtask, Task } from "~/types";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  parseISO,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
} from "date-fns";
import {
  flattenProjectItems,
  projectItemDueDate,
  projectItemTitle,
  type ProjectItem,
} from "~/utils/projectItems";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const { dateFnsLocale } = useDateLocale();
const route = useRoute();
const projectId = computed(() => route.params.id as string);

const { getProject, fetchProjects } = useProjects();
const { tasks, fetchTasks } = useTasks(projectId);
const { fetchWorkspace } = useWorkspace();

const project = computed(() => getProject(projectId.value));
const currentMonth = ref(new Date());
const showModal = ref(false);
const selectedTask = ref<Task | null>(null);
const defaultDueDate = ref<string | undefined>(undefined);
const showSubtaskModal = ref(false);
const selectedSubtask = ref<Subtask | null>(null);
const selectedSubtaskParent = ref<Task | null>(null);

const weekdayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

onMounted(async () => {
  await fetchWorkspace();
  await fetchProjects();
  await fetchTasks(projectId.value);
});

const calendarDays = computed(() => {
  const monthStart = startOfMonth(currentMonth.value);
  const monthEnd = endOfMonth(currentMonth.value);
  const start = startOfWeek(monthStart, { weekStartsOn: 1 });
  const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
});

const monthLabel = computed(() =>
  format(currentMonth.value, "MMMM yyyy", { locale: dateFnsLocale.value }),
);

function itemsForDay(day: Date): ProjectItem[] {
  return flattenProjectItems(tasks.value).filter((item) => {
    const due = projectItemDueDate(item);
    if (!due) return false;
    return isSameDay(parseISO(due), day);
  });
}

function openTask(task: Task) {
  selectedTask.value = task;
  defaultDueDate.value = undefined;
  showSubtaskModal.value = false;
  showModal.value = true;
}

function openSubtask(payload: { subtask: Subtask; parent: Task }) {
  selectedSubtask.value = payload.subtask;
  selectedSubtaskParent.value = payload.parent;
  showModal.value = false;
  showSubtaskModal.value = true;
}

function openItem(item: ProjectItem) {
  if (item.kind === "task") openTask(item.task);
  else openSubtask({ subtask: item.subtask, parent: item.parent });
}

function openNewTask(dueDate?: string) {
  selectedTask.value = null;
  defaultDueDate.value = dueDate;
  showSubtaskModal.value = false;
  showModal.value = true;
}

function openNewForDay(day: Date) {
  openNewTask(format(day, "yyyy-MM-dd"));
}

async function onSaved() {
  await fetchTasks(projectId.value);
  if (selectedSubtask.value) {
    const parent = tasks.value.find((t) => t.id === selectedSubtaskParent.value?.id);
    const fresh = parent?.subtasks?.find((s) => s.id === selectedSubtask.value?.id);
    selectedSubtask.value = fresh ?? null;
    selectedSubtaskParent.value = parent ?? null;
  }
}

const agendaDays = computed(() => {
  return calendarDays.value
    .filter((day) => isSameMonth(day, currentMonth.value))
    .map((day) => ({
      day,
      items: itemsForDay(day),
    }))
    .filter((entry) => entry.items.length > 0);
});
</script>

<template>
  <div class="p-4 md:p-6">
    <LayoutProjectHeader v-if="project" :project="project" :subtitle="t('projects.calendarSuffix')">
      <template #actions>
        <UButton icon="i-lucide-plus" size="sm" class="shrink-0" @click="openNewTask()">
          {{ t("projects.addTask") }}
        </UButton>
      </template>
    </LayoutProjectHeader>

    <LayoutProjectNav class="mb-6" />

    <div class="mb-4 flex items-center justify-between">
      <UButton icon="i-lucide-chevron-left" variant="ghost" color="neutral" @click="currentMonth = subMonths(currentMonth, 1)" />
      <h2 class="text-base font-semibold sm:text-lg">{{ monthLabel }}</h2>
      <UButton icon="i-lucide-chevron-right" variant="ghost" color="neutral" @click="currentMonth = addMonths(currentMonth, 1)" />
    </div>

    <div class="space-y-4 md:hidden">
      <p v-if="agendaDays.length === 0" class="py-8 text-center text-slate-400">
        {{ t("calendar.noTasksThisMonth") }}
      </p>
      <div
        v-for="entry in agendaDays"
        :key="entry.day.toISOString()"
        class="rounded-xl border border-slate-200 bg-white p-4"
      >
        <h3 class="mb-2 text-sm font-semibold text-slate-700">
          {{ format(entry.day, "EEEE d MMM", { locale: dateFnsLocale }) }}
        </h3>
        <button
          v-for="item in entry.items"
          :key="item.id"
          type="button"
          class="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-white last:mb-0"
          :class="item.kind === 'subtask' ? 'border border-white/40 border-dashed' : ''"
          :style="{ backgroundColor: project?.color || '#0B6E7A' }"
          @click="openItem(item)"
        >
          <span v-if="item.kind === 'subtask'" class="opacity-80">↳</span>
          {{ projectItemTitle(item) }}
        </button>
      </div>
    </div>

    <div class="hidden grid-cols-7 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 md:grid">
      <div
        v-for="day in weekdayKeys"
        :key="day"
        class="bg-slate-50 px-2 py-2 text-center text-xs font-medium text-slate-500"
      >
        {{ t(`calendar.weekdays.${day}`) }}
      </div>

      <button
        v-for="day in calendarDays"
        :key="day.toISOString()"
        type="button"
        class="min-h-24 bg-white p-2 text-left transition-colors hover:bg-slate-50"
        :class="!isSameMonth(day, currentMonth) ? 'opacity-40' : ''"
        @click="openNewForDay(day)"
      >
        <p class="mb-1 text-xs font-medium text-slate-500">{{ format(day, "d") }}</p>
        <div
          v-for="item in itemsForDay(day).slice(0, 3)"
          :key="item.id"
          class="mb-1 cursor-pointer truncate rounded px-1 py-0.5 text-xs text-white"
          :class="item.kind === 'subtask' ? 'border border-dashed border-white/50' : ''"
          :style="{ backgroundColor: project?.color || '#0B6E7A' }"
          @click.stop="openItem(item)"
        >
          <span v-if="item.kind === 'subtask'">↳ </span>{{ projectItemTitle(item) }}
        </div>
        <p
          v-if="itemsForDay(day).length > 3"
          class="text-[10px] text-slate-400"
        >
          +{{ itemsForDay(day).length - 3 }}
        </p>
      </button>
    </div>

    <TasksTaskModal
      :task="selectedTask"
      :project-id="projectId"
      :open="showModal"
      :default-due-date="defaultDueDate"
      @update:open="showModal = $event"
      @saved="onSaved"
    />

    <TasksSubtaskModal
      :subtask="selectedSubtask"
      :parent="selectedSubtaskParent"
      :open="showSubtaskModal"
      @update:open="showSubtaskModal = $event"
      @saved="onSaved"
      @open-parent="openTask"
    />
  </div>
</template>
