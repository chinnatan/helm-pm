<script setup lang="ts">
import type { Task } from "~/types";
import { format, parseISO } from "date-fns";

const props = defineProps<{
  task: Task;
  showProject?: boolean;
  draggable?: boolean;
}>();

const cardContext = computed(() => ({
  showProject: props.showProject !== false,
}));

const { display } = useTaskCardDisplay(() => props.task, cardContext);

const emit = defineEmits<{
  click: [task: Task];
  pin: [task: Task, pinned: boolean];
  delete: [task: Task];
}>();

const { t } = useI18n();
const { dateFnsLocale } = useDateLocale();
const { priorityMeta } = useTaskLabels();
const { canManageMembers } = useWorkspace();

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

const visibleSubtasks = computed(() => {
  const subs = [...(props.task.subtasks ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  return subs.slice(0, 3);
});

const hiddenSubtaskCount = computed(() => {
  const total = props.task.subtasks?.length ?? 0;
  return Math.max(0, total - 3);
});

const dueDateLabel = computed(() => {
  if (!props.task.due_date) return null;
  return format(parseISO(props.task.due_date), "d MMM", { locale: dateFnsLocale.value });
});

function personName(profile?: { full_name?: string | null; email?: string } | null) {
  return profile?.full_name || profile?.email || "";
}
</script>

<template>
  <div
    class="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
    @click="emit('click', task)"
  >
    <div class="mb-2 flex items-start justify-between gap-2">
      <h4 class="text-sm font-medium text-slate-800 leading-snug">{{ task.title }}</h4>
      <div class="flex shrink-0 items-center gap-0.5">
        <UButton
          v-if="canManageMembers"
          icon="i-lucide-trash-2"
          variant="ghost"
          color="error"
          size="xs"
          :aria-label="t('tasks.delete')"
          @click.stop="emit('delete', task)"
        />
        <UButton
          v-if="showProject !== false"
          :icon="isPinned ? 'i-lucide-pin' : 'i-lucide-pin-off'"
          variant="ghost"
          color="neutral"
          size="xs"
          @click.stop="emit('pin', task, !isPinned)"
        />
      </div>
    </div>

    <div v-if="showProject && task.projects" class="mb-2 flex items-center gap-1.5">
      <span
        class="h-2 w-2 rounded-full"
        :style="{ backgroundColor: task.projects.color }"
      />
      <span class="text-xs text-slate-500">{{ task.projects.name }}</span>
    </div>

    <div
      v-if="display.showCustomer && task.customers?.name"
      class="mb-2 flex items-center gap-1.5"
    >
      <UIcon name="i-lucide-building-2" class="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span class="text-xs text-slate-500">{{ task.customers.name }}</span>
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
        v-if="display.showMilestone && task.milestones"
        color="warning"
        variant="subtle"
        size="xs"
      >
        {{ task.milestones.title }}
      </UBadge>

      <template v-if="display.showLabels">
        <UBadge
          v-for="tl in task.task_labels"
          :key="tl.labels?.id"
          variant="subtle"
          size="xs"
          :style="{ backgroundColor: tl.labels?.color + '20', color: tl.labels?.color }"
        >
          {{ tl.labels?.name }}
        </UBadge>
      </template>
    </div>

    <div
      v-if="display.showSubtaskList && visibleSubtasks.length"
      class="mt-2 space-y-0.5 border-t border-slate-100 pt-2"
    >
      <div
        v-for="sub in visibleSubtasks"
        :key="sub.id"
        class="flex items-center gap-1.5 text-xs"
      >
        <span
          class="shrink-0"
          :class="sub.completed ? 'text-green-500' : 'text-slate-300'"
        >
          {{ sub.completed ? "✓" : "○" }}
        </span>
        <span
          class="min-w-0 flex-1 truncate leading-snug"
          :class="sub.completed ? 'text-slate-400 line-through' : 'text-slate-600'"
        >
          {{ sub.title }}
        </span>
        <UserAvatar
          v-if="sub.profiles"
          :src="sub.profiles.avatar_url"
          :name="sub.profiles.full_name"
          :email="sub.profiles.email"
          size="xs"
          class="shrink-0"
        />
      </div>
      <p v-if="hiddenSubtaskCount > 0" class="text-[11px] text-slate-400">
        {{ t("tasks.moreSubtasks", { n: hiddenSubtaskCount }) }}
      </p>
    </div>

    <div
      v-if="display.showPeople && (task.profiles || task.tester)"
      class="mt-2 flex flex-wrap items-center gap-2"
    >
      <div v-if="task.profiles" class="flex items-center gap-1.5" :title="t('tasks.assignee')">
        <UserAvatar
          :src="task.profiles.avatar_url"
          :name="task.profiles.full_name"
          :email="task.profiles.email"
        />
        <span class="text-xs text-slate-500">
          <span class="text-slate-400">{{ t("tasks.devShort") }}</span>
          {{ personName(task.profiles) }}
        </span>
      </div>
      <div v-if="task.tester" class="flex items-center gap-1.5" :title="t('tasks.tester')">
        <UserAvatar
          :src="task.tester.avatar_url"
          :name="task.tester.full_name"
          :email="task.tester.email"
          tone="amber"
        />
        <span class="text-xs text-slate-500">
          <span class="text-slate-400">{{ t("tasks.testerShort") }}</span>
          {{ personName(task.tester) }}
        </span>
      </div>
    </div>
  </div>
</template>
