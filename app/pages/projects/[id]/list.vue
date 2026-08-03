<script setup lang="ts">
import type { Subtask, Task, TaskStatus, TaskPriority } from "~/types";
import { TASK_STATUS_VALUES } from "~/types";
import { format, parseISO } from "date-fns";
import {
  flattenProjectItems,
  projectItemDueDate,
  projectItemMatchesPerson,
  projectItemPriority,
  projectItemStatus,
  type ProjectItem,
} from "~/utils/projectItems";

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
const showSubtaskModal = ref(false);
const selectedSubtask = ref<Subtask | null>(null);
const selectedSubtaskParent = ref<Task | null>(null);

onMounted(async () => {
  await fetchWorkspace();
  await fetchProjects();
  await fetchTasks(projectId.value);

  const statusQuery = route.query.status as string | undefined;
  if (statusQuery && TASK_STATUS_VALUES.includes(statusQuery as TaskStatus)) {
    statusFilter.value = statusQuery as TaskStatus;
  }
});

const filteredItems = computed(() => {
  return flattenProjectItems(tasks.value).filter((item) => {
    if (statusFilter.value !== "all" && projectItemStatus(item) !== statusFilter.value) {
      return false;
    }
    if (
      priorityFilter.value !== "all" &&
      projectItemPriority(item) !== priorityFilter.value
    ) {
      return false;
    }
    if (assigneeFilter.value !== "all") {
      if (!projectItemMatchesPerson(item, assigneeFilter.value)) return false;
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

function openNew() {
  selectedTask.value = null;
  showSubtaskModal.value = false;
  showModal.value = true;
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

function formatDueDate(date: string) {
  return format(parseISO(date), "d MMM yyyy", { locale: dateFnsLocale.value });
}

function personName(profile?: { full_name?: string | null; email?: string } | null) {
  return profile?.full_name || profile?.email || t("common.emDash");
}

function itemAssignee(item: ProjectItem) {
  return item.kind === "task" ? item.task.profiles : item.subtask.profiles;
}

function itemTester(item: ProjectItem) {
  return item.kind === "task" ? item.task.tester : item.subtask.tester;
}

function itemMilestone(item: ProjectItem) {
  return item.kind === "task"
    ? item.task.milestones?.title
    : item.parent.milestones?.title;
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
          v-for="item in filteredItems"
          :key="item.id"
          type="button"
          class="w-full rounded-xl border bg-white p-4 text-left transition-colors hover:bg-slate-50"
          :class="
            item.kind === 'subtask'
              ? 'border-dashed border-slate-300'
              : 'border-slate-200'
          "
          @click="openItem(item)"
        >
          <p
            v-if="item.kind === 'subtask'"
            class="mb-0.5 text-[11px] text-slate-400"
          >
            {{ t("tasks.subtaskOf", { title: item.parent.title }) }}
          </p>
          <p class="font-medium text-slate-800">
            {{ item.kind === "task" ? item.task.title : item.subtask.title }}
          </p>
          <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{{ statusLabel(projectItemStatus(item)) }}</span>
            <span>{{ priorityLabel(projectItemPriority(item)) }}</span>
            <span v-if="itemAssignee(item)">
              {{ t("tasks.devShort") }} {{ personName(itemAssignee(item)) }}
            </span>
            <span v-if="itemTester(item)">
              {{ t("tasks.testerShort") }} {{ personName(itemTester(item)) }}
            </span>
            <span v-if="itemMilestone(item)">{{ itemMilestone(item) }}</span>
            <span>
              {{
                projectItemDueDate(item)
                  ? formatDueDate(projectItemDueDate(item)!)
                  : t("common.emDash")
              }}
            </span>
          </div>
        </button>
        <p v-if="filteredItems.length === 0" class="py-8 text-center text-slate-400">
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
              v-for="item in filteredItems"
              :key="item.id"
              class="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
              :class="item.kind === 'subtask' ? 'bg-slate-50/50' : ''"
              @click="openItem(item)"
            >
              <td class="px-4 py-3 font-medium text-slate-800">
                <span
                  v-if="item.kind === 'subtask'"
                  class="mr-1.5 text-[11px] font-normal text-slate-400"
                >
                  ↳
                </span>
                {{ item.kind === "task" ? item.task.title : item.subtask.title }}
                <span
                  v-if="item.kind === 'subtask'"
                  class="mt-0.5 block text-[11px] font-normal text-slate-400"
                >
                  {{ t("tasks.subtaskOf", { title: item.parent.title }) }}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-600">{{ statusLabel(projectItemStatus(item)) }}</td>
              <td class="px-4 py-3 text-slate-600">{{ priorityLabel(projectItemPriority(item)) }}</td>
              <td class="px-4 py-3 text-slate-600">{{ personName(itemAssignee(item)) }}</td>
              <td class="px-4 py-3 text-slate-600">{{ personName(itemTester(item)) }}</td>
              <td class="px-4 py-3 text-slate-600">
                {{ itemMilestone(item) || t("common.emDash") }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{
                  projectItemDueDate(item)
                    ? formatDueDate(projectItemDueDate(item)!)
                    : t("common.emDash")
                }}
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="filteredItems.length === 0" class="p-8 text-center text-slate-400">
          {{ t("projects.noTasksFound") }}
        </p>
      </div>
    </template>

    <TasksTaskModal
      :task="selectedTask"
      :project-id="projectId"
      :open="showModal"
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
