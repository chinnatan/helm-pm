<script setup lang="ts">
import type { Task, TaskStatus } from "~/types";
import { TASK_STATUS_VALUES } from "~/types";
import { VueDraggable } from "vue-draggable-plus";

const props = defineProps<{
  projectId: string;
  mineOnly?: boolean;
}>();

const { statuses } = useTaskLabels();
const user = useSupabaseUser();
const { t } = useI18n();
const { confirm } = useConfirmDialog();
const { tasksByStatus, updateTaskStatus, deleteTask, subscribeToProject, fetchTasks } = useTasks(
  toRef(props, "projectId"),
);

const emit = defineEmits<{
  "task-click": [task: Task];
  "add-task": [status: TaskStatus];
}>();

const columns = statuses;
const isDragging = ref(false);
const suppressClick = ref(false);

function emptyColumns(): Record<TaskStatus, Task[]> {
  return {
    backlog: [],
    todo: [],
    in_progress: [],
    ready_for_test: [],
    testing: [],
    done: [],
    release: [],
    cancelled: [],
  };
}

const localColumns = ref<Record<TaskStatus, Task[]>>(emptyColumns());

function filterMine(tasks: Task[]) {
  if (!props.mineOnly) return tasks;
  const uid = user.value?.id;
  if (!uid) return [];
  return tasks.filter((t) => t.assignee_id === uid || t.tester_id === uid);
}

function syncFromServer(val: Record<TaskStatus, Task[]>) {
  for (const status of TASK_STATUS_VALUES) {
    const target = localColumns.value[status];
    const source = filterMine(val[status] ?? []);
    target.splice(0, target.length, ...source);
  }
}

watch(
  tasksByStatus,
  (val) => {
    if (isDragging.value) return;
    syncFromServer(val);
  },
  { immediate: true, deep: true },
);

watch(
  () => props.mineOnly,
  () => {
    if (!isDragging.value) syncFromServer(tasksByStatus.value);
  },
);

function onDragStart() {
  isDragging.value = true;
  suppressClick.value = true;
  window.getSelection()?.removeAllRanges();
}

async function onDragEnd() {
  const pending: Promise<unknown>[] = [];

  for (const status of TASK_STATUS_VALUES) {
    const items = localColumns.value[status] ?? [];
    for (let i = 0; i < items.length; i++) {
      const task = items[i]!;
      if (task.status !== status || task.sort_order !== i) {
        pending.push(updateTaskStatus(task.id, status, i));
      }
    }
  }

  try {
    await Promise.all(pending);
    await fetchTasks(props.projectId);
  } finally {
    isDragging.value = false;
    window.setTimeout(() => {
      suppressClick.value = false;
    }, 50);
  }
}

function openTask(task: Task) {
  if (suppressClick.value || isDragging.value) return;
  emit("task-click", task);
}

async function handleDeleteTask(task: Task) {
  const ok = await confirm({
    title: t("tasks.delete"),
    description: t("tasks.deleteConfirm"),
    confirmLabel: t("common.delete"),
    color: "error",
  });
  if (!ok) return;
  await deleteTask(task.id);
  await fetchTasks(props.projectId);
}

let unsubscribe: (() => void) | null = null;

onMounted(() => {
  unsubscribe = subscribeToProject(props.projectId, () => {
    if (!isDragging.value) fetchTasks(props.projectId);
  });
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
      class="flex w-[min(18rem,85vw)] shrink-0 snap-start flex-col rounded-xl border border-ocean-200 bg-ocean-100/90 p-3 shadow-sm"
    >
      <div class="mb-3 flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-ocean-900">{{ col.label }}</h3>
        <div class="flex items-center gap-1">
          <UBadge color="primary" variant="subtle" size="xs">
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
        class="kanban-column flex min-h-[220px] flex-col gap-2 rounded-lg border border-dashed border-ocean-300/70 bg-white/50 p-1.5 select-none"
        :animation="200"
        :force-fallback="true"
        :fallback-on-body="true"
        :fallback-tolerance="3"
        :scroll="true"
        :bubble-scroll="true"
        ghost-class="kanban-ghost"
        chosen-class="kanban-chosen"
        drag-class="kanban-drag"
        @start="onDragStart"
        @end="onDragEnd"
      >
        <div
          v-for="task in localColumns[col.value]"
          :key="task.id"
          class="touch-manipulation select-none"
        >
          <TasksTaskCard
            :task="task"
            :show-project="false"
            @click="openTask(task)"
            @delete="handleDeleteTask"
          />
        </div>
      </VueDraggable>
    </div>
  </div>
</template>

<style>
.kanban-column,
.kanban-column * {
  -webkit-user-select: none;
  user-select: none;
  -webkit-user-drag: none;
}

.kanban-ghost {
  opacity: 0.4;
}

.kanban-chosen,
.kanban-drag {
  cursor: grabbing;
}

.kanban-drag,
.sortable-fallback {
  -webkit-user-select: none !important;
  user-select: none !important;
  box-shadow: 0 8px 24px rgb(15 23 42 / 0.18);
}
</style>
