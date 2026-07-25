<script setup lang="ts">
import type { Task, TaskStatus } from "~/types";
import { TASK_STATUSES } from "~/types";
import { VueDraggable } from "vue-draggable-plus";

const props = defineProps<{ projectId: string }>();

const { tasksByStatus, updateTaskStatus, subscribeToProject, fetchTasks } = useTasks(
  toRef(props, "projectId"),
);

const emit = defineEmits<{
  "task-click": [task: Task];
}>();

const columns = TASK_STATUSES;

const localColumns = ref<Record<TaskStatus, Task[]>>({
  todo: [],
  in_progress: [],
  done: [],
  blocked: [],
});

watch(
  tasksByStatus,
  (val) => {
    for (const status of Object.keys(localColumns.value) as TaskStatus[]) {
      const target = localColumns.value[status];
      const source = val[status] ?? [];
      target.splice(0, target.length, ...source);
    }
  },
  { immediate: true, deep: true },
);

async function onDragEnd(status: TaskStatus) {
  const items = localColumns.value[status] ?? [];
  for (let i = 0; i < items.length; i++) {
    const task = items[i]!;
    if (task.status !== status || task.sort_order !== i) {
      await updateTaskStatus(task.id, status, i);
    }
  }
  await fetchTasks(props.projectId);
}

function handleDragEnd(status: TaskStatus) {
  void onDragEnd(status);
}

let unsubscribe: (() => void) | null = null;

onMounted(() => {
  unsubscribe = subscribeToProject(props.projectId, () => fetchTasks(props.projectId));
});

onUnmounted(() => {
  unsubscribe?.();
});
</script>

<template>
  <div class="flex gap-4 overflow-x-auto pb-4">
    <div
      v-for="col in columns"
      :key="`${projectId}-${col.value}`"
      class="flex w-72 shrink-0 flex-col rounded-xl bg-slate-100 p-3"
    >
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-700">{{ col.label }}</h3>
        <UBadge color="neutral" variant="subtle" size="xs">
          {{ localColumns[col.value]?.length ?? 0 }}
        </UBadge>
      </div>

      <VueDraggable
        v-model="localColumns[col.value]"
        group="tasks"
        class="flex min-h-[200px] flex-col gap-2"
        :animation="200"
        @end="handleDragEnd(col.value)"
      >
        <TasksTaskCard
          v-for="task in localColumns[col.value]"
          :key="task.id"
          :task="task"
          :show-project="false"
          @click="emit('task-click', task)"
        />
      </VueDraggable>
    </div>
  </div>
</template>
