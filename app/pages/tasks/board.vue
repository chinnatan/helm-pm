<script setup lang="ts">
import type { Subtask, Task, TaskCardDensity, TaskStatus } from "~/types";
import { TASK_CARD_DENSITY_VALUES } from "~/types";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const route = useRoute();
const { filters } = useTaskScope();

const { fetchTasks, tasks } = useTasks(filters);
const { fetchWorkspace } = useWorkspace();
const { fetchLabels } = useLabels();
const { taskCardDensity, updateTaskCardDensity } = useProfile();

const showModal = ref(false);
const showTemplateManager = ref(false);
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

watch(filters, () => fetchTasks(), { deep: true });

onMounted(async () => {
  await fetchWorkspace();
  await fetchLabels();
  await fetchTasks();
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
  await fetchTasks();
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
    <TasksTaskScopeBar>
      <template #actions>
        <UButton icon="i-lucide-copy" size="sm" variant="soft" data-testid="template-manage" @click="showTemplateManager = true">
          {{ t("templates.manage") }}
        </UButton>
        <UButton icon="i-lucide-plus" size="sm" class="shrink-0" data-testid="add-task" @click="openNewTask()">
          {{ t("projects.addTask") }}
        </UButton>
      </template>
    </TasksTaskScopeBar>

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
      :filters="filters"
      :mine-only="mineOnly"
      @task-click="openTask"
      @subtask-click="openSubtask"
      @add-task="openNewTask"
    />

    <TasksTaskModal
      :task="selectedTask"
      :open="showModal"
      :default-status="defaultStatus"
      :default-customer-id="filters.customerId"
      :default-feature-id="filters.featureId"
      @update:open="showModal = $event"
      @saved="onSaved"
    />
    <TasksTemplateManager v-model:open="showTemplateManager" />

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
