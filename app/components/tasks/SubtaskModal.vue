<script setup lang="ts">
import type { JobRole, Subtask, Task, TaskStatus } from "~/types";
import { PRIORITY_DEFAULT_HOURS } from "~/types";

const props = defineProps<{
  subtask: Subtask | null;
  parent: Task | null;
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  saved: [];
  "open-parent": [task: Task];
}>();

const { t } = useI18n();
const { statuses } = useTaskLabels();
const { updateSubtask, deleteSubtask } = useTasks();
const { members, canManageMembers } = useWorkspace();
const { confirm } = useConfirmDialog();
const { projects } = useProjects();
const { scheduleCapacityAlerts } = useCapacityAlerts();

const form = reactive({
  title: "",
  description: "",
  status: "todo" as TaskStatus,
  assignee_id: null as string | null,
  tester_id: null as string | null,
  due_date: "",
  estimate_hours: "",
});

const saving = ref(false);
const deleting = ref(false);

const isMobile = ref(false);
let mobileMq: MediaQueryList | null = null;

function updateIsMobile() {
  isMobile.value = mobileMq?.matches ?? false;
}

onMounted(() => {
  mobileMq = window.matchMedia("(max-width: 767px)");
  updateIsMobile();
  mobileMq.addEventListener("change", updateIsMobile);
});

onUnmounted(() => {
  mobileMq?.removeEventListener("change", updateIsMobile);
  mobileMq = null;
});

function memberLabel(userId: string, jobRole: JobRole | null | undefined) {
  const member = members.value.find((m) => m.user_id === userId);
  const name = member?.profiles?.full_name || member?.profiles?.email || userId;
  if (!jobRole) return name;
  return `${name} (${t(`team.jobRoles.${jobRole}`)})`;
}

function sortedMembers(prefer: JobRole) {
  return [...members.value].sort((a, b) => {
    const aScore = a.job_role === prefer ? 0 : a.job_role ? 1 : 2;
    const bScore = b.job_role === prefer ? 0 : b.job_role ? 1 : 2;
    return aScore - bScore;
  });
}

function parseEstimate(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : null;
}

watch(
  () => [props.open, props.subtask] as const,
  ([open]) => {
    if (!open || !props.subtask) return;
    const sub = props.subtask;
    form.title = sub.title;
    form.description = sub.description ?? "";
    form.status = (sub.status ?? (sub.completed ? "done" : "todo")) as TaskStatus;
    form.assignee_id = sub.assignee_id;
    form.tester_id = sub.tester_id;
    form.due_date = sub.due_date ?? "";
    form.estimate_hours =
      sub.estimate_hours != null ? String(sub.estimate_hours) : "";
  },
);

const defaultEstimateHours = computed(() => {
  const priority = props.parent?.priority ?? "medium";
  return PRIORITY_DEFAULT_HOURS[priority] ?? PRIORITY_DEFAULT_HOURS.medium;
});

const statusItems = computed(() =>
  statuses.value.map((s) => ({ label: s.label, value: s.value })),
);

const developerItems = computed(() => [
  { label: t("tasks.unassigned"), value: null },
  ...sortedMembers("developer").map((m) => ({
    label: memberLabel(m.user_id, m.job_role),
    value: m.user_id,
  })),
]);

const testerItems = computed(() => [
  { label: t("tasks.unassigned"), value: null },
  ...sortedMembers("tester").map((m) => ({
    label: memberLabel(m.user_id, m.job_role),
    value: m.user_id,
  })),
]);

async function save() {
  if (!props.subtask || !form.title.trim()) return;
  saving.value = true;
  await updateSubtask(props.subtask.id, {
    title: form.title.trim(),
    description: form.description || null,
    status: form.status,
    assignee_id: form.assignee_id || null,
    tester_id: form.tester_id || null,
    due_date: form.due_date || null,
    estimate_hours: parseEstimate(form.estimate_hours),
  });
  saving.value = false;
  emit("update:open", false);
  emit("saved");
  scheduleCapacityAlerts({ projects: projects.value });
}

async function handleDelete() {
  if (!props.subtask || !canManageMembers.value) return;
  const ok = await confirm({
    title: t("tasks.deleteSubtask"),
    description: t("tasks.deleteSubtaskConfirm"),
    confirmLabel: t("common.delete"),
    color: "error",
  });
  if (!ok) return;
  deleting.value = true;
  const { error } = await deleteSubtask(props.subtask.id);
  deleting.value = false;
  if (error) return;
  emit("update:open", false);
  emit("saved");
  scheduleCapacityAlerts({ projects: projects.value });
}

function openParent() {
  if (!props.parent) return;
  emit("update:open", false);
  emit("open-parent", props.parent);
}
</script>

<template>
  <UModal
    :open="open"
    :title="t('tasks.editSubtask')"
    :fullscreen="isMobile"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <button
          v-if="parent"
          type="button"
          class="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-100"
          @click="openParent"
        >
          <UIcon name="i-lucide-corner-left-up" class="size-4 shrink-0 text-slate-400" />
          <span class="min-w-0 truncate">
            {{ t("tasks.subtaskOf", { title: parent.title }) }}
          </span>
          <UIcon name="i-lucide-chevron-right" class="ml-auto size-4 shrink-0 text-slate-400" />
        </button>

        <UFormField :label="t('tasks.title')" required>
          <UInput
            v-model="form.title"
            :placeholder="t('tasks.addSubtask')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('tasks.description')">
          <RichTextEditor
            v-model="form.description"
            :placeholder="t('tasks.descriptionPlaceholder')"
            :rows="3"
            variant="full"
          />
        </UFormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField :label="t('tasks.status')">
            <USelect v-model="form.status" :items="statusItems" class="w-full" />
          </UFormField>

          <UFormField
            :label="t('tasks.estimateHours')"
            :hint="t('tasks.estimateHoursHint', { hours: defaultEstimateHours })"
          >
            <UInput
              v-model="form.estimate_hours"
              type="number"
              min="0.5"
              step="0.5"
              class="w-full"
              :placeholder="t('tasks.estimateHoursPlaceholder')"
            />
          </UFormField>

          <UFormField :label="t('tasks.assignee')">
            <USelect
              v-model="form.assignee_id"
              :items="developerItems"
              :placeholder="t('tasks.selectAssignee')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('tasks.tester')">
            <USelect
              v-model="form.tester_id"
              :items="testerItems"
              :placeholder="t('tasks.selectTester')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('tasks.dueDate')">
            <UInput v-model="form.due_date" type="date" class="w-full" />
          </UFormField>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-between gap-2">
        <UButton
          v-if="canManageMembers"
          variant="ghost"
          color="error"
          :loading="deleting"
          :disabled="saving"
          @click="handleDelete"
        >
          {{ t("tasks.deleteSubtask") }}
        </UButton>
        <div v-else />
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="emit('update:open', false)">
            {{ t("common.cancel") }}
          </UButton>
          <UButton
            :loading="saving"
            :disabled="!form.title.trim() || deleting"
            @click="save"
          >
            {{ t("common.save") }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
