<script setup lang="ts">
import type { Milestone, Subtask, Task } from "~/types";
import {
  MILESTONE_STATUS_VALUES,
  type MilestoneStatus,
} from "~/types";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const route = useRoute();
const projectId = computed(() => route.params.id as string);
const projectIdRef = toRef(() => route.params.id as string);

const { getProject, fetchProjects } = useProjects();
const { tasks, fetchTasks, updateTask, updateSubtask } = useTasks(projectId);
const { fetchWorkspace } = useWorkspace();
const {
  milestones,
  fetchMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
} = useMilestones(projectIdRef);
const { dependencies } = useDependencies(projectIdRef);

const project = computed(() => getProject(projectId.value));
const showModal = ref(false);
const selectedTask = ref<Task | null>(null);
const showSubtaskModal = ref(false);
const selectedSubtask = ref<Subtask | null>(null);
const selectedSubtaskParent = ref<Task | null>(null);
const showMilestone = ref(false);
const editingMilestone = ref<Milestone | null>(null);
const milestoneTitle = ref("");
const milestoneStart = ref("");
const milestoneDue = ref("");
const milestoneStatus = ref<MilestoneStatus>("planned");
const savingMilestone = ref(false);

const milestoneStatusItems = computed(() =>
  MILESTONE_STATUS_VALUES.map((s) => ({
    label: t(`projects.milestoneStatus.${s}`),
    value: s,
  })),
);

const linkedTasks = computed(() => {
  if (!editingMilestone.value) return [];
  return tasks.value.filter((t) => t.milestone_id === editingMilestone.value!.id);
});

onMounted(async () => {
  await fetchWorkspace();
  await fetchProjects();
  await fetchTasks(projectId.value);
  await fetchMilestones();
});

async function handleDateUpdate(taskId: string, startDate: string, endDate: string) {
  await updateTask(taskId, { start_date: startDate, due_date: endDate });
}

async function handleSubtaskDateUpdate(
  subtaskId: string,
  _startDate: string,
  endDate: string,
) {
  await updateSubtask(subtaskId, { due_date: endDate });
}

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

function openNewTask() {
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

function openCreateMilestone() {
  editingMilestone.value = null;
  milestoneTitle.value = "";
  milestoneStart.value = "";
  milestoneDue.value = "";
  milestoneStatus.value = "planned";
  showMilestone.value = true;
}

function openEditMilestone(ms: Milestone) {
  editingMilestone.value = ms;
  milestoneTitle.value = ms.title;
  milestoneStart.value = ms.start_date || ms.date;
  milestoneDue.value = ms.due_date || ms.date;
  milestoneStatus.value = ms.status ?? "planned";
  showMilestone.value = true;
}

async function handleSaveMilestone() {
  if (!milestoneTitle.value || !milestoneStart.value || !milestoneDue.value) return;
  savingMilestone.value = true;

  if (editingMilestone.value) {
    await updateMilestone(editingMilestone.value.id, {
      title: milestoneTitle.value,
      start_date: milestoneStart.value,
      due_date: milestoneDue.value,
      status: milestoneStatus.value,
    });
  } else {
    await createMilestone(
      milestoneTitle.value,
      milestoneStart.value,
      milestoneDue.value,
      milestoneStatus.value,
    );
  }

  savingMilestone.value = false;
  showMilestone.value = false;
  editingMilestone.value = null;
  milestoneTitle.value = "";
  milestoneStart.value = "";
  milestoneDue.value = "";
  milestoneStatus.value = "planned";
}

function closeMilestoneModal() {
  showMilestone.value = false;
  editingMilestone.value = null;
}

async function handleDeleteMilestone() {
  if (!editingMilestone.value) return;
  savingMilestone.value = true;
  await deleteMilestone(editingMilestone.value.id);
  savingMilestone.value = false;
  showMilestone.value = false;
  editingMilestone.value = null;
}
</script>

<template>
  <div class="p-4 md:p-6">
    <LayoutProjectHeader v-if="project" :project="project">
      <template #actions>
        <UButton
          icon="i-lucide-flag"
          size="sm"
          variant="outline"
          color="neutral"
          class="shrink-0"
          @click="openCreateMilestone"
        >
          {{ t("projects.addMilestone") }}
        </UButton>
        <UButton icon="i-lucide-plus" size="sm" class="shrink-0" @click="openNewTask">
          {{ t("projects.addTask") }}
        </UButton>
      </template>
    </LayoutProjectHeader>

    <LayoutProjectNav class="mb-6" />

    <GanttChart
      :tasks="tasks"
      :milestones="milestones"
      :dependencies="dependencies"
      @update-dates="handleDateUpdate"
      @update-subtask-dates="handleSubtaskDateUpdate"
      @task-click="openTask"
      @subtask-click="openSubtask"
      @milestone-click="openEditMilestone"
    />

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

    <UModal
      v-model:open="showMilestone"
      :title="editingMilestone ? t('projects.editMilestone') : t('projects.addMilestone')"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('projects.milestoneTitle')">
            <UInput v-model="milestoneTitle" class="w-full" />
          </UFormField>
          <UFormField :label="t('tasks.status')">
            <USelect
              v-model="milestoneStatus"
              :items="milestoneStatusItems"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UFormField :label="t('projects.milestoneStart')">
              <UInput v-model="milestoneStart" type="date" class="w-full" />
            </UFormField>
            <UFormField :label="t('projects.milestoneDue')">
              <UInput v-model="milestoneDue" type="date" class="w-full" />
            </UFormField>
          </div>
          <div v-if="editingMilestone" class="space-y-2">
            <p class="text-sm font-medium text-slate-700">{{ t("projects.linkedTasks") }}</p>
            <ul v-if="linkedTasks.length" class="space-y-1">
              <li
                v-for="task in linkedTasks"
                :key="task.id"
                class="cursor-pointer rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-ocean-50"
                @click="showMilestone = false; openTask(task)"
              >
                {{ task.title }}
              </li>
            </ul>
            <p v-else class="text-sm text-slate-400">{{ t("projects.noLinkedTasks") }}</p>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full items-center justify-between gap-2">
          <UButton
            v-if="editingMilestone"
            variant="ghost"
            color="error"
            :loading="savingMilestone"
            @click="handleDeleteMilestone"
          >
            {{ t("common.delete") }}
          </UButton>
          <div v-else />
          <div class="flex gap-2">
            <UButton variant="ghost" color="neutral" @click="closeMilestoneModal">
              {{ t("common.cancel") }}
            </UButton>
            <UButton
              :loading="savingMilestone"
              :disabled="!milestoneTitle || !milestoneStart || !milestoneDue"
              @click="handleSaveMilestone"
            >
              {{ editingMilestone ? t("common.save") : t("common.create") }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
