<script setup lang="ts">
import type { Task, TaskStatus } from "~/types";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const route = useRoute();
const projectId = computed(() => route.params.id as string);

const { getProject, fetchProjects } = useProjects();
const { fetchTasks } = useTasks(projectId);
const { fetchWorkspace } = useWorkspace();
const { fetchLabels } = useLabels();

const project = computed(() => getProject(projectId.value));
const showModal = ref(false);
const selectedTask = ref<Task | null>(null);
const defaultStatus = ref<TaskStatus | undefined>(undefined);

onMounted(async () => {
  await fetchWorkspace();
  await fetchProjects();
  await fetchLabels();
  await fetchTasks(projectId.value);
});

function openNewTask(status?: TaskStatus) {
  selectedTask.value = null;
  defaultStatus.value = status;
  showModal.value = true;
}

function openTask(task: Task) {
  selectedTask.value = task;
  defaultStatus.value = undefined;
  showModal.value = true;
}

async function onSaved() {
  await fetchTasks(projectId.value);
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

    <LayoutProjectNav class="mb-6" />

    <KanbanBoard
      :project-id="projectId"
      @task-click="openTask"
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
  </div>
</template>
