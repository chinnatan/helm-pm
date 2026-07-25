<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const { activeTab, tabs, tasks, loading, fetchPlannerTasks, togglePin, markDone } = usePlanner();
const { fetchWorkspace } = useWorkspace();

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
</script>

<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">My Planner</h1>
        <p class="text-sm text-slate-500">Your personal task view</p>
      </div>
      <LayoutNotificationBell />
    </div>

    <div class="mb-6 flex gap-2">
      <UButton
        v-for="tab in tabs"
        :key="tab.value"
        :variant="activeTab === tab.value ? 'solid' : 'outline'"
        color="neutral"
        size="sm"
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
