<script setup lang="ts">
import type { Task } from "~/types";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  parseISO,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
} from "date-fns";

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

const weekdayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

onMounted(async () => {
  await fetchWorkspace();
  await fetchProjects();
  await fetchTasks(projectId.value);
});

const calendarDays = computed(() => {
  const start = startOfMonth(currentMonth.value);
  const end = endOfMonth(currentMonth.value);
  return eachDayOfInterval({ start, end });
});

const monthLabel = computed(() =>
  format(currentMonth.value, "MMMM yyyy", { locale: dateFnsLocale.value }),
);

function tasksForDay(day: Date) {
  return tasks.value.filter((task) => {
    if (!task.due_date) return false;
    return isSameDay(parseISO(task.due_date), day);
  });
}

function openTask(task: Task) {
  selectedTask.value = task;
  showModal.value = true;
}

const agendaDays = computed(() => {
  return calendarDays.value
    .filter((day) => isSameMonth(day, currentMonth.value))
    .map((day) => ({
      day,
      tasks: tasksForDay(day),
    }))
    .filter((entry) => entry.tasks.length > 0);
});
</script>

<template>
  <div class="p-4 md:p-6">
    <div v-if="project" class="mb-4">
      <h1 class="text-xl font-bold text-slate-900">
        {{ project.name }} — {{ t("projects.calendarSuffix") }}
      </h1>
    </div>

    <LayoutProjectNav class="mb-6" />

    <div class="mb-4 flex items-center justify-between">
      <UButton icon="i-lucide-chevron-left" variant="ghost" color="neutral" @click="currentMonth = subMonths(currentMonth, 1)" />
      <h2 class="text-base font-semibold sm:text-lg">{{ monthLabel }}</h2>
      <UButton icon="i-lucide-chevron-right" variant="ghost" color="neutral" @click="currentMonth = addMonths(currentMonth, 1)" />
    </div>

    <!-- Mobile agenda -->
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
          v-for="task in entry.tasks"
          :key="task.id"
          type="button"
          class="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-white last:mb-0"
          :style="{ backgroundColor: project?.color || '#1e3a5f' }"
          @click="openTask(task)"
        >
          {{ task.title }}
        </button>
      </div>
    </div>

    <!-- Desktop month grid -->
    <div class="hidden grid-cols-7 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 md:grid">
      <div
        v-for="day in weekdayKeys"
        :key="day"
        class="bg-slate-50 px-2 py-2 text-center text-xs font-medium text-slate-500"
      >
        {{ t(`calendar.weekdays.${day}`) }}
      </div>

      <div
        v-for="day in calendarDays"
        :key="day.toISOString()"
        class="min-h-24 bg-white p-2"
        :class="!isSameMonth(day, currentMonth) ? 'opacity-40' : ''"
      >
        <p class="mb-1 text-xs font-medium text-slate-500">{{ format(day, "d") }}</p>
        <div
          v-for="task in tasksForDay(day)"
          :key="task.id"
          class="mb-1 cursor-pointer truncate rounded px-1 py-0.5 text-xs text-white"
          :style="{ backgroundColor: project?.color || '#1e3a5f' }"
          @click="openTask(task)"
        >
          {{ task.title }}
        </div>
      </div>
    </div>

    <TasksTaskModal
      :task="selectedTask"
      :project-id="projectId"
      :open="showModal"
      @update:open="showModal = $event"
      @saved="fetchTasks(projectId)"
    />
  </div>
</template>
