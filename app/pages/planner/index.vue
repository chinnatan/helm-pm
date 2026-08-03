<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const { activeTab, tabs, tasks, loading, fetchPlannerTasks, togglePin, markDone } = usePlanner();
const { fetchWorkspace } = useWorkspace();
const { deleteTask } = useTasks();
const { confirm } = useConfirmDialog();

const selectedTask = ref<import("~/types").Task | null>(null);
const showModal = ref(false);

onMounted(async () => {
  await fetchWorkspace();
  await fetchPlannerTasks();
});

function handleTaskClick(task: import("~/types").Task) {
  selectedTask.value = task;
  showModal.value = true;
}

function handlePin(task: import("~/types").Task, pinned: boolean) {
  togglePin(task.id, pinned);
}

async function handleDelete(task: import("~/types").Task) {
  const ok = await confirm({
    title: t("tasks.delete"),
    description: t("tasks.deleteConfirm"),
    confirmLabel: t("common.delete"),
    color: "error",
  });
  if (!ok) return;
  await deleteTask(task.id);
  if (selectedTask.value?.id === task.id) {
    showModal.value = false;
    selectedTask.value = null;
  }
  await fetchPlannerTasks();
}
</script>

<template>
  <div class="p-4 md:p-6">
    <div class="mb-6">
      <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">{{ t("planner.title") }}</h1>
      <p class="text-sm text-slate-500">{{ t("planner.subtitle") }}</p>
    </div>

    <div class="mb-6 flex gap-2 overflow-x-auto pb-1">
      <UButton
        v-for="tab in tabs"
        :key="tab.value"
        :variant="activeTab === tab.value ? 'solid' : 'outline'"
        color="neutral"
        size="sm"
        class="shrink-0"
        @click="activeTab = tab.value"
      >
        {{ tab.label }}
      </UButton>
    </div>

    <PlannerView
      :tasks="tasks"
      :loading="loading"
      @task-click="handleTaskClick"
      @mark-done="markDone"
      @pin="handlePin"
      @delete="handleDelete"
    />

    <TasksTaskModal
      v-if="selectedTask"
      :task="selectedTask"
      :project-id="selectedTask.project_id"
      :open="showModal"
      @update:open="showModal = $event"
      @saved="fetchPlannerTasks"
    />
  </div>
</template>
