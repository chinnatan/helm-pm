<script setup lang="ts">
import type { Task, TaskStatus } from "~/types";
import { VueDraggable } from "vue-draggable-plus";

const props = defineProps<{ projectId: string }>();

const { statuses } = useTaskLabels();
const { tasksByStatus, updateTaskStatus, subscribeToProject, fetchTasks } = useTasks(
  toRef(props, "projectId"),
);

const emit = defineEmits<{
  "task-click": [task: Task];
  "add-task": [status: TaskStatus];
}>();

const columns = statuses;

const localColumns = ref<Record<TaskStatus, Task[]>>({
  todo: [],
  in_progress: [],
  ready_for_test: [],
  testing: [],
  done: [],
  release: [],
  cancelled: [],
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
  <div class="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
    <div
      v-for="col in columns"
      :key="`${projectId}-${col.value}`"
      class="flex w-[min(18rem,85vw)] shrink-0 snap-start flex-col rounded-xl bg-slate-100 p-3"
    >
      <div class="mb-3 flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-slate-700">{{ col.label }}</h3>
        <div class="flex items-center gap-1">
          <UBadge color="neutral" variant="subtle" size="xs">
            {{ localColumns[col.value]?.length ?? 0 }}
          </UBadge>
          <UButton
            icon="i-lucide-plus"
            variant="ghost"
            color="neutral"
            size="xs"
            @click="emit('add-task', col.value)"
          />
        </div>
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
