<script setup lang="ts">
import type { Task } from "~/types";

defineProps<{
  tasks: Task[];
  loading?: boolean;
}>();

const { t } = useI18n();

const emit = defineEmits<{
  "task-click": [task: Task];
  "mark-done": [taskId: string];
  pin: [task: Task, pinned: boolean];
}>();
</script>

<template>
  <div v-if="loading" class="flex justify-center py-12">
    <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-slate-400" />
  </div>

  <div v-else-if="tasks.length === 0" class="rounded-xl border border-dashed border-slate-300 p-12 text-center">
    <UIcon name="i-lucide-calendar-check" class="mx-auto mb-3 h-10 w-10 text-slate-300" />
    <p class="text-slate-500">{{ t("planner.empty") }}</p>
  </div>

  <div v-else class="space-y-2">
    <div
      v-for="task in tasks"
      :key="task.id"
      class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
    >
      <UCheckbox @update:model-value="emit('mark-done', task.id)" />
      <div class="flex-1 min-w-0" @click="emit('task-click', task)">
        <TasksTaskCard :task="task" :show-project="true" class="border-0 shadow-none p-0" />
      </div>
    </div>
  </div>
</template>
