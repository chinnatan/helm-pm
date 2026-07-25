<script setup lang="ts">
import type { Milestone, Task } from "~/types";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const route = useRoute();
const projectId = computed(() => route.params.id as string);
const projectIdRef = toRef(() => route.params.id as string);

const { getProject, fetchProjects } = useProjects();
const { tasks, fetchTasks, updateTask } = useTasks(projectId);
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
const showMilestone = ref(false);
const editingMilestone = ref<Milestone | null>(null);
const milestoneTitle = ref("");
const milestoneDate = ref("");
const savingMilestone = ref(false);

onMounted(async () => {
  await fetchWorkspace();
  await fetchProjects();
  await fetchTasks(projectId.value);
  await fetchMilestones();
});

async function handleDateUpdate(taskId: string, startDate: string, endDate: string) {
  await updateTask(taskId, { start_date: startDate, due_date: endDate });
}

function openTask(task: Task) {
  selectedTask.value = task;
  showModal.value = true;
}

function openNewTask() {
  selectedTask.value = null;
  showModal.value = true;
}

function openCreateMilestone() {
  editingMilestone.value = null;
  milestoneTitle.value = "";
  milestoneDate.value = "";
  showMilestone.value = true;
}

function openEditMilestone(ms: { id: string; title: string; date: string }) {
  editingMilestone.value = ms as Milestone;
  milestoneTitle.value = ms.title;
  milestoneDate.value = ms.date;
  showMilestone.value = true;
}

async function handleSaveMilestone() {
  if (!milestoneTitle.value || !milestoneDate.value) return;
  savingMilestone.value = true;

  if (editingMilestone.value) {
    await updateMilestone(editingMilestone.value.id, {
      title: milestoneTitle.value,
      date: milestoneDate.value,
    });
  } else {
    await createMilestone(milestoneTitle.value, milestoneDate.value);
  }

  savingMilestone.value = false;
  showMilestone.value = false;
  editingMilestone.value = null;
  milestoneTitle.value = "";
  milestoneDate.value = "";
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
      @task-click="openTask"
      @milestone-click="openEditMilestone"
    />

    <TasksTaskModal
      :task="selectedTask"
      :project-id="projectId"
      :open="showModal"
      @update:open="showModal = $event"
      @saved="fetchTasks(projectId)"
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
          <UFormField :label="t('projects.milestoneDate')">
            <UInput v-model="milestoneDate" type="date" class="w-full" />
          </UFormField>
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
              :disabled="!milestoneTitle || !milestoneDate"
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
