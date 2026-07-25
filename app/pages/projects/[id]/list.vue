<script setup lang="ts">
import type { Task, TaskStatus, TaskPriority } from "~/types";
import { TASK_STATUS_VALUES } from "~/types";
import { format, parseISO } from "date-fns";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const { dateFnsLocale } = useDateLocale();
const { statuses, priorities, statusLabel, priorityLabel } = useTaskLabels();
const route = useRoute();
const projectId = computed(() => route.params.id as string);

const { getProject, fetchProjects } = useProjects();
const { tasks, loading, searchQuery, fetchTasks } = useTasks(projectId);
const { fetchWorkspace, members } = useWorkspace();

const project = computed(() => getProject(projectId.value));
const statusFilter = ref<TaskStatus | "all">("all");
const priorityFilter = ref<TaskPriority | "all">("all");
const assigneeFilter = ref<string | "all">("all");

const showModal = ref(false);
const selectedTask = ref<Task | null>(null);

onMounted(async () => {
  await fetchWorkspace();
  await fetchProjects();
  await fetchTasks(projectId.value);

  const statusQuery = route.query.status as string | undefined;
  if (statusQuery && TASK_STATUS_VALUES.includes(statusQuery as TaskStatus)) {
    statusFilter.value = statusQuery as TaskStatus;
  }
});

const filteredTasks = computed(() => {
  return tasks.value.filter((task) => {
    if (statusFilter.value !== "all" && task.status !== statusFilter.value) return false;
    if (priorityFilter.value !== "all" && task.priority !== priorityFilter.value) return false;
    if (assigneeFilter.value !== "all") {
      const match =
        task.assignee_id === assigneeFilter.value ||
        task.tester_id === assigneeFilter.value;
      if (!match) return false;
    }
    return true;
  });
});

const statusFilterItems = computed(() => [
  { label: t("projects.allStatus"), value: "all" },
  ...statuses.value.map((s) => ({ label: s.label, value: s.value })),
]);

const priorityFilterItems = computed(() => [
  { label: t("projects.allPriority"), value: "all" },
  ...priorities.value.map((p) => ({ label: p.label, value: p.value })),
]);

const assigneeFilterItems = computed(() => [
  { label: t("projects.allAssignees"), value: "all" },
  ...members.value.map((m) => ({
    label: m.profiles?.full_name || m.profiles?.email || "",
    value: m.user_id,
  })),
]);

watch(searchQuery, () => fetchTasks(projectId.value));

function openTask(task: Task) {
  selectedTask.value = task;
  showModal.value = true;
}

function openNew() {
  selectedTask.value = null;
  showModal.value = true;
}

function formatDueDate(date: string) {
  return format(parseISO(date), "d MMM yyyy", { locale: dateFnsLocale.value });
}

function personName(profile?: { full_name?: string | null; email?: string } | null) {
  return profile?.full_name || profile?.email || t("common.emDash");
}
</script>

<template>
  <div class="p-4 md:p-6">
    <LayoutProjectHeader v-if="project" :project="project" :subtitle="t('projects.listSuffix')">
      <template #actions>
        <UButton icon="i-lucide-plus" size="sm" class="shrink-0" @click="openNew">
          {{ t("projects.addTask") }}
        </UButton>
      </template>
    </LayoutProjectHeader>

    <LayoutProjectNav class="mb-6" />

    <div class="mb-4 flex flex-wrap items-end gap-3">
      <UFormField :label="t('projects.searchPlaceholder')" class="w-full sm:w-64">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          :placeholder="t('projects.searchPlaceholder')"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('projects.filterStatus')" class="w-full sm:w-40">
        <USelect
          v-model="statusFilter"
          :items="statusFilterItems"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('projects.filterPriority')" class="w-full sm:w-40">
        <USelect
          v-model="priorityFilter"
          :items="priorityFilterItems"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('projects.filterAssignee')" class="w-full sm:w-48">
        <USelect
          v-model="assigneeFilter"
          :items="assigneeFilterItems"
          class="w-full"
        />
      </UFormField>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-slate-400" />
    </div>

    <template v-else>
      <div class="space-y-2 md:hidden">
        <button
          v-for="task in filteredTasks"
          :key="task.id"
          type="button"
          class="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50"
          @click="openTask(task)"
        >
          <p class="font-medium text-slate-800">{{ task.title }}</p>
          <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{{ statusLabel(task.status) }}</span>
            <span>{{ priorityLabel(task.priority) }}</span>
            <span v-if="task.profiles">{{ t("tasks.devShort") }} {{ personName(task.profiles) }}</span>
            <span v-if="task.tester">{{ t("tasks.testerShort") }} {{ personName(task.tester) }}</span>
            <span v-if="task.milestones">{{ task.milestones.title }}</span>
            <span>{{ task.due_date ? formatDueDate(task.due_date) : t("common.emDash") }}</span>
          </div>
        </button>
        <p v-if="filteredTasks.length === 0" class="py-8 text-center text-slate-400">
          {{ t("projects.noTasksFound") }}
        </p>
      </div>

      <div class="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table class="w-full min-w-[800px] text-sm">
          <thead class="border-b border-slate-200 bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-slate-600">{{ t("projects.colTitle") }}</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">{{ t("projects.colStatus") }}</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">{{ t("projects.colPriority") }}</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">{{ t("projects.colAssignee") }}</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">{{ t("projects.colTester") }}</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">{{ t("projects.colMilestone") }}</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">{{ t("projects.colDueDate") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="task in filteredTasks"
              :key="task.id"
              class="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
              @click="openTask(task)"
            >
              <td class="px-4 py-3 font-medium text-slate-800">{{ task.title }}</td>
              <td class="px-4 py-3 text-slate-600">{{ statusLabel(task.status) }}</td>
              <td class="px-4 py-3 text-slate-600">{{ priorityLabel(task.priority) }}</td>
              <td class="px-4 py-3 text-slate-600">{{ personName(task.profiles) }}</td>
              <td class="px-4 py-3 text-slate-600">{{ personName(task.tester) }}</td>
              <td class="px-4 py-3 text-slate-600">
                {{ task.milestones?.title || t("common.emDash") }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ task.due_date ? formatDueDate(task.due_date) : t("common.emDash") }}
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="filteredTasks.length === 0" class="p-8 text-center text-slate-400">
          {{ t("projects.noTasksFound") }}
        </p>
      </div>
    </template>

    <TasksTaskModal
      :task="selectedTask"
      :project-id="projectId"
      :open="showModal"
      @update:open="showModal = $event"
      @saved="fetchTasks(projectId)"
    />
  </div>
</template>
