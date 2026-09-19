<script setup lang="ts">
import type { Subtask, Task } from "~/types";
import { format, parseISO } from "date-fns";

const props = defineProps<{
  subtask: Subtask;
  parent: Task;
}>();

const emit = defineEmits<{
  click: [];
  delete: [];
}>();

const { t } = useI18n();
const { dateFnsLocale } = useDateLocale();
const { canManageMembers } = useWorkspace();
const { taskCardDensity } = useProfile();
const { priorityMeta } = useTaskLabels();

const showLabels = computed(() => taskCardDensity.value !== "compact");
const showPeople = computed(() => taskCardDensity.value !== "compact");

const priority = computed(() => priorityMeta(props.parent.priority));

const dueDateLabel = computed(() => {
  if (!props.subtask.due_date) return null;
  return format(parseISO(props.subtask.due_date), "d MMM", {
    locale: dateFnsLocale.value,
  });
});

const startDateLabel = computed(() => {
  if (!props.subtask.start_date) return null;
  return format(parseISO(props.subtask.start_date), "d MMM", {
    locale: dateFnsLocale.value,
  });
});

const dateRangeLabel = computed(() => {
  if (startDateLabel.value && dueDateLabel.value) {
    return `${startDateLabel.value} → ${dueDateLabel.value}`;
  }
  return dueDateLabel.value;
});

function personName(profile?: { full_name?: string | null; email?: string } | null) {
  return profile?.full_name || profile?.email || "";
}
</script>

<template>
  <div
    class="cursor-pointer rounded-lg border border-dashed border-slate-300 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
    @click="emit('click')"
  >
    <div class="mb-2 flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <p class="mb-0.5 text-[11px] leading-snug text-slate-400">
          {{ t("tasks.subtaskOf", { title: parent.title }) }}
        </p>
        <h4
          class="text-sm font-medium leading-snug text-slate-800"
          :class="subtask.completed ? 'text-slate-400 line-through' : ''"
        >
          {{ subtask.title }}
        </h4>
      </div>
      <UButton
        v-if="canManageMembers"
        icon="i-lucide-trash-2"
        variant="ghost"
        color="error"
        size="xs"
        class="shrink-0"
        :aria-label="t('tasks.deleteSubtask')"
        @click.stop="emit('delete')"
      />
    </div>

    <div class="flex flex-wrap items-center gap-1.5">
      <UBadge :color="(priority?.color ?? 'neutral') as 'neutral'" variant="subtle" size="xs">
        {{ priority?.label }}
      </UBadge>

      <span v-if="dateRangeLabel" class="text-xs text-slate-500">
        {{ dateRangeLabel }}
      </span>

      <span v-if="subtask.estimate_hours != null" class="text-xs text-slate-400">
        {{ subtask.estimate_hours }}h
      </span>

      <template v-if="showLabels">
        <UBadge
          v-for="tl in subtask.subtask_labels"
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
      v-if="showPeople && (subtask.profiles || subtask.tester)"
      class="mt-2 flex flex-wrap items-center gap-2"
    >
      <div
        v-if="subtask.profiles"
        class="flex items-center gap-1.5"
        :title="t('tasks.assignee')"
      >
        <UserAvatar
          :src="subtask.profiles.avatar_url"
          :name="subtask.profiles.full_name"
          :email="subtask.profiles.email"
        />
        <span class="text-xs text-slate-500">
          <span class="text-slate-400">{{ t("tasks.devShort") }}</span>
          {{ personName(subtask.profiles) }}
        </span>
      </div>
      <div
        v-if="subtask.tester"
        class="flex items-center gap-1.5"
        :title="t('tasks.tester')"
      >
        <UserAvatar
          :src="subtask.tester.avatar_url"
          :name="subtask.tester.full_name"
          :email="subtask.tester.email"
          tone="amber"
        />
        <span class="text-xs text-slate-500">
          <span class="text-slate-400">{{ t("tasks.testerShort") }}</span>
          {{ personName(subtask.tester) }}
        </span>
      </div>
    </div>
  </div>
</template>
