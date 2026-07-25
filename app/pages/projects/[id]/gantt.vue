<script setup lang="ts">
import type { Task } from "~/types";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const route = useRoute();
const projectId = computed(() => route.params.id as string);
const projectIdRef = toRef(() => route.params.id as string);

const { getProject, fetchProjects } = useProjects();
const { tasks, fetchTasks, updateTask } = useTasks(projectId);
const { fetchWorkspace } = useWorkspace();
const { milestones, fetchMilestones, createMilestone } = useMilestones(projectIdRef);
const { dependencies } = useDependencies(projectIdRef);

const project = computed(() => getProject(projectId.value));
const showModal = ref(false);
const selectedTask = ref<Task | null>(null);
const showMilestone = ref(false);
const milestoneTitle = ref("");
const milestoneDate = ref("");

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

async function handleCreateMilestone() {
  if (!milestoneTitle.value || !milestoneDate.value) return;
  await createMilestone(milestoneTitle.value, milestoneDate.value);
  showMilestone.value = false;
  milestoneTitle.value = "";
  milestoneDate.value = "";
}
</script>

<template>
  <div class="p-6">
    <div v-if="project" class="mb-4 flex items-center justify-between">
      <h1 class="text-xl font-bold text-slate-900">
        {{ project.name }} — {{ t("projects.ganttSuffix") }}
      </h1>
      <UButton icon="i-lucide-flag" size="sm" variant="outline" color="neutral" @click="showMilestone = true">
        {{ t("projects.addMilestone") }}
      </UButton>
    </div>

    <LayoutProjectNav class="mb-6" />

    <GanttChart
      :tasks="tasks"
      :milestones="milestones"
      :dependencies="dependencies"
      @update-dates="handleDateUpdate"
    />

    <TasksTaskModal
      :task="selectedTask"
      :project-id="projectId"
      :open="showModal"
      @update:open="showModal = $event"
      @saved="fetchTasks(projectId)"
    />

    <UModal v-model:open="showMilestone" :title="t('projects.addMilestone')">
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
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="showMilestone = false">
            {{ t("common.cancel") }}
          </UButton>
          <UButton @click="handleCreateMilestone">{{ t("common.create") }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
