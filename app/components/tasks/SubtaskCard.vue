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

const dueDateLabel = computed(() => {
  if (!props.subtask.due_date) return null;
  return format(parseISO(props.subtask.due_date), "d MMM", {
    locale: dateFnsLocale.value,
  });
});

function personName(profile?: { full_name?: string | null; email?: string } | null) {
  return profile?.full_name || profile?.email || "";
}
</script>

<template>
  <div
    class="cursor-pointer rounded-lg border border-dashed border-slate-300 bg-white/90 p-2.5 shadow-sm transition-shadow hover:shadow-md"
    @click="emit('click')"
  >
    <div class="mb-1 flex items-start justify-between gap-2">
      <p class="text-[11px] leading-snug text-slate-400">
        {{ t("tasks.subtaskOf", { title: parent.title }) }}
      </p>
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

    <h4
      class="text-sm font-medium leading-snug text-slate-800"
      :class="subtask.completed ? 'text-slate-400 line-through' : ''"
    >
      {{ subtask.title }}
    </h4>

    <div class="mt-2 flex flex-wrap items-center gap-1.5">
      <span v-if="dueDateLabel" class="text-xs text-slate-500">
        {{ dueDateLabel }}
      </span>
      <span v-if="subtask.estimate_hours != null" class="text-xs text-slate-400">
        {{ subtask.estimate_hours }}h
      </span>
      <UBadge
        v-for="tl in subtask.subtask_labels"
        :key="tl.labels?.id"
        variant="subtle"
        size="xs"
        :style="{ backgroundColor: tl.labels?.color + '20', color: tl.labels?.color }"
      >
        {{ tl.labels?.name }}
      </UBadge>
    </div>

    <div
      v-if="subtask.profiles || subtask.tester"
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
