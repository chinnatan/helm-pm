<script setup lang="ts">
import type { Subtask, Task, TaskCardDensity, TaskStatus } from "~/types";
import { TASK_CARD_DENSITY_VALUES } from "~/types";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const route = useRoute();
const projectId = computed(() => route.params.id as string);

const { getProject, fetchProjects } = useProjects();
const { fetchTasks, tasks } = useTasks(projectId);
const { fetchWorkspace } = useWorkspace();
const { fetchLabels } = useLabels();
const { taskCardDensity, updateTaskCardDensity } = useProfile();

const project = computed(() => getProject(projectId.value));
const showModal = ref(false);
const selectedTask = ref<Task | null>(null);
const showSubtaskModal = ref(false);
const selectedSubtask = ref<Subtask | null>(null);
const selectedSubtaskParent = ref<Task | null>(null);
const defaultStatus = ref<TaskStatus | undefined>(undefined);
const mineOnly = ref(false);
const savingDensity = ref(false);

const densityOptions = computed(() =>
  TASK_CARD_DENSITY_VALUES.map((value) => ({
    value,
    label: t(`profile.taskCard.${value}`),
    icon:
      value === "compact"
        ? "i-lucide-rows-2"
        : value === "detailed"
          ? "i-lucide-rows-4"
          : "i-lucide-rows-3",
  })),
);

async function setDensity(density: TaskCardDensity) {
  if (density === taskCardDensity.value || savingDensity.value) return;
  savingDensity.value = true;
  await updateTaskCardDensity(density);
  savingDensity.value = false;
}

onMounted(async () => {
  await fetchWorkspace();
  await fetchProjects();
  await fetchLabels();
  await fetchTasks(projectId.value);
  await openTaskFromQuery();
});

async function openTaskFromQuery() {
  const taskId = route.query.task;
  if (typeof taskId !== "string" || !taskId) return;
  const task = tasks.value.find((t) => t.id === taskId);
  if (task) openTask(task);
}

function openNewTask(status?: TaskStatus) {
  selectedTask.value = null;
  defaultStatus.value = status;
  showSubtaskModal.value = false;
  showModal.value = true;
}

function openTask(task: Task) {
  selectedTask.value = task;
  defaultStatus.value = undefined;
  showSubtaskModal.value = false;
  showModal.value = true;
}

function openSubtask(payload: { subtask: Subtask; parent: Task }) {
  selectedSubtask.value = payload.subtask;
  selectedSubtaskParent.value = payload.parent;
  showModal.value = false;
  showSubtaskModal.value = true;
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
</script>

<template>
  <div class="p-4 md:p-6">
    <LayoutProjectHeader v-if="project" :project="project">
      <template #actions>
        <UButton icon="i-lucide-plus" size="sm" class="shrink-0" @click="openNewTask()">
          {{ t("projects.addTask") }}
        </UButton>
      </template>
    </LayoutProjectHeader>

    <LayoutProjectNav class="mb-4" />

    <div class="mb-3 flex flex-wrap items-center gap-2">
      <div class="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
        <UButton
          size="xs"
          :variant="!mineOnly ? 'soft' : 'ghost'"
          color="neutral"
          @click="mineOnly = false"
        >
          {{ t("projects.allTasks") }}
        </UButton>
        <UButton
          size="xs"
          icon="i-lucide-user"
          :variant="mineOnly ? 'soft' : 'ghost'"
          color="neutral"
          @click="mineOnly = true"
        >
          {{ t("projects.myTasks") }}
        </UButton>
      </div>

      <div
        class="ml-auto inline-flex items-center gap-1.5"
        :title="t('profile.taskCard.title')"
      >
        <span class="hidden text-xs text-slate-500 sm:inline">
          {{ t("projects.cardDensity") }}
        </span>
        <div class="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          <UButton
            v-for="opt in densityOptions"
            :key="opt.value"
            size="xs"
            :icon="opt.icon"
            :variant="taskCardDensity === opt.value ? 'soft' : 'ghost'"
            color="neutral"
            :aria-label="opt.label"
            :title="opt.label"
            :disabled="savingDensity"
            @click="setDensity(opt.value)"
          />
        </div>
      </div>
    </div>

    <KanbanBoard
      :project-id="projectId"
      :mine-only="mineOnly"
      @task-click="openTask"
      @subtask-click="openSubtask"
      @add-task="openNewTask"
    />

    <TasksTaskModal
      :task="selectedTask"
      :project-id="projectId"
      :open="showModal"
      :default-status="defaultStatus"
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
