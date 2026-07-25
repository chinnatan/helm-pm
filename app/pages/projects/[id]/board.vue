<script setup lang="ts">
import type { Task } from "~/types";

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

onMounted(async () => {
  await fetchWorkspace();
  await fetchProjects();
  await fetchLabels();
  await fetchTasks(projectId.value);
});

function openNewTask() {
  selectedTask.value = null;
  showModal.value = true;
}

function openTask(task: Task) {
  selectedTask.value = task;
  showModal.value = true;
}

async function onSaved() {
  await fetchTasks(projectId.value);
}
</script>

<template>
  <div class="p-6">
    <div v-if="project" class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
          :style="{ backgroundColor: project.color }"
        >
          {{ project.name[0]?.toUpperCase() }}
        </div>
        <h1 class="text-xl font-bold text-slate-900">{{ project.name }}</h1>
      </div>
      <UButton icon="i-lucide-plus" size="sm" @click="openNewTask">{{ t("projects.addTask") }}</UButton>
    </div>

    <LayoutProjectNav class="mb-6" />

    <KanbanBoard :project-id="projectId" @task-click="openTask" />

    <TasksTaskModal
      :task="selectedTask"
      :project-id="projectId"
      :open="showModal"
      @update:open="showModal = $event"
      @saved="onSaved"
    />
  </div>
</template>
