<script setup lang="ts">
import type { Task } from "~/types";
import { format, parseISO } from "date-fns";

const props = defineProps<{
  task: Task;
  showProject?: boolean;
  draggable?: boolean;
}>();

const emit = defineEmits<{
  click: [task: Task];
  pin: [task: Task, pinned: boolean];
}>();

const { dateFnsLocale } = useDateLocale();
const { priorityMeta } = useTaskLabels();

const priority = computed(() => priorityMeta(props.task.priority));

const isPinned = computed(
  () => props.task.user_task_preferences?.some((p) => p.is_pinned) ?? false,
);

const subtaskProgress = computed(() => {
  const subs = props.task.subtasks ?? [];
  if (subs.length === 0) return null;
  const done = subs.filter((s) => s.completed).length;
  return `${done}/${subs.length}`;
});

const dueDateLabel = computed(() => {
  if (!props.task.due_date) return null;
  return format(parseISO(props.task.due_date), "d MMM", { locale: dateFnsLocale.value });
});
</script>

<template>
  <div
    class="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
    @click="emit('click', task)"
  >
    <div class="mb-2 flex items-start justify-between gap-2">
      <h4 class="text-sm font-medium text-slate-800 leading-snug">{{ task.title }}</h4>
      <UButton
        v-if="showProject !== false"
        :icon="isPinned ? 'i-lucide-pin' : 'i-lucide-pin-off'"
        variant="ghost"
        color="neutral"
        size="xs"
        class="shrink-0"
        @click.stop="emit('pin', task, !isPinned)"
      />
    </div>

    <div v-if="showProject && task.projects" class="mb-2 flex items-center gap-1.5">
      <span
        class="h-2 w-2 rounded-full"
        :style="{ backgroundColor: task.projects.color }"
      />
      <span class="text-xs text-slate-500">{{ task.projects.name }}</span>
    </div>

    <div class="flex flex-wrap items-center gap-1.5">
      <UBadge :color="(priority?.color ?? 'neutral') as 'neutral'" variant="subtle" size="xs">
        {{ priority?.label }}
      </UBadge>

      <span v-if="dueDateLabel" class="text-xs text-slate-500">
        {{ dueDateLabel }}
      </span>

      <span v-if="subtaskProgress" class="text-xs text-slate-400">
        ✓ {{ subtaskProgress }}
      </span>

      <UBadge
        v-for="tl in task.task_labels"
        :key="tl.labels?.id"
        variant="subtle"
        size="xs"
        :style="{ backgroundColor: tl.labels?.color + '20', color: tl.labels?.color }"
      >
        {{ tl.labels?.name }}
      </UBadge>
    </div>

    <div v-if="task.profiles" class="mt-2 flex items-center gap-1.5">
      <div
        class="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-medium text-slate-600"
      >
        {{ (task.profiles.full_name || task.profiles.email)?.[0]?.toUpperCase() }}
      </div>
      <span class="text-xs text-slate-500">
        {{ task.profiles.full_name || task.profiles.email }}
      </span>
    </div>
  </div>
</template>
