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
const mineOnly = ref(false);

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

    <LayoutProjectNav class="mb-4" />

    <div class="mb-3 flex items-center gap-2">
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
    </div>

    <KanbanBoard
      :project-id="projectId"
      :mine-only="mineOnly"
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
