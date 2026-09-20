<script setup lang="ts">
import type { ActivityLog, JobRole, Subtask, Task, TaskStatus } from "~/types";
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
const { toLocaleString } = useDateLocale();
const { statuses } = useTaskLabels();
const { tasks, updateSubtask, deleteSubtask, setSubtaskLabels, fetchSubtaskActivity } =
  useTasks();
const { members, canManageMembers } = useWorkspace();
const { confirm } = useConfirmDialog();
const { labels, fetchLabels } = useLabels();
const { projects } = useProjects();
const { scheduleCapacityAlerts } = useCapacityAlerts();

const form = reactive({
  title: "",
  description: "",
  status: "todo" as TaskStatus,
  task_id: "" as string,
  assignee_id: null as string | null,
  tester_id: null as string | null,
  start_date: "",
  due_date: "",
  estimate_hours: "",
  label_ids: [] as string[],
});

const saving = ref(false);
const deleting = ref(false);
const activeTab = ref("details");
const activity = ref<ActivityLog[]>([]);
const loadingActivity = ref(false);

const modalTabs = computed(() => [
  { key: "details", label: t("tasks.tabs.details") },
  { key: "comments", label: t("tasks.tabs.comments") },
  { key: "attachments", label: t("tasks.tabs.attachments") },
  { key: "activity", label: t("tasks.tabs.activity") },
]);

function setActiveTab(key: string) {
  activeTab.value = key;
  if (key === "activity" && props.subtask && activity.value.length === 0) {
    void loadActivity(props.subtask.id);
  }
}

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

const profileNameById = computed(() => {
  const map = new Map<string, string>();
  for (const m of members.value) {
    map.set(m.user_id, m.profiles?.full_name || m.profiles?.email || m.user_id);
  }
  return map;
});

const taskTitleById = computed(() => {
  const map = new Map<string, string>();
  for (const task of tasks.value) {
    map.set(task.id, task.title);
  }
  return map;
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

function resolveActivityValue(field: string | null, value: string | null) {
  if (!value) return t("common.none");
  if (field === "assignee_id" || field === "tester_id") {
    return profileNameById.value.get(value) ?? value;
  }
  if (field === "task_id") {
    return taskTitleById.value.get(value) ?? value;
  }
  if (field === "status") {
    return t(`status.${value}`);
  }
  return value;
}

function fieldLabel(field: string | null) {
  if (!field) return "";
  const key = `tasks.fields.${field}`;
  const translated = t(key);
  return translated === key ? field : translated;
}

function actionLabel(action: string) {
  if (action === "created") return t("common.created");
  if (action === "updated") return t("common.updated");
  return action;
}

function hydrateFormFromSubtask(sub: Subtask) {
  form.title = sub.title;
  form.description = sub.description ?? "";
  form.status = (sub.status ?? (sub.completed ? "done" : "todo")) as TaskStatus;
  form.task_id = sub.task_id || props.parent?.id || "";
  form.assignee_id = sub.assignee_id;
  form.tester_id = sub.tester_id;
  form.start_date = sub.start_date ?? "";
  form.due_date = sub.due_date ?? "";
  form.estimate_hours =
    sub.estimate_hours != null ? String(sub.estimate_hours) : "";
  form.label_ids =
    (sub.subtask_labels?.map((tl) => tl.labels?.id).filter(Boolean) as string[]) ??
    [];
}

async function loadActivity(subtaskId: string) {
  loadingActivity.value = true;
  try {
    activity.value = await fetchSubtaskActivity(subtaskId);
  } finally {
    loadingActivity.value = false;
  }
}

async function loadSupportingData() {
  await fetchLabels();
}

watch(
  () => [props.open, props.subtask?.id] as const,
  ([open]) => {
    if (!open || !props.subtask) return;
    activeTab.value = "details";
    hydrateFormFromSubtask(props.subtask);
    activity.value = [];
    void loadSupportingData();
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

const labelOptions = computed(() =>
  labels.value.map((l) => ({ label: l.name, value: l.id })),
);

const parentTaskItems = computed(() =>
  tasks.value.map((task) => ({
    label: task.title,
    value: task.id,
  })),
);

async function save() {
  if (!props.subtask || !form.title.trim() || !form.task_id) return;
  saving.value = true;
  const { error } = await updateSubtask(props.subtask.id, {
    title: form.title.trim(),
    description: form.description || null,
    status: form.status,
    task_id: form.task_id,
    assignee_id: form.assignee_id || null,
    tester_id: form.tester_id || null,
    start_date: form.start_date || null,
    due_date: form.due_date || null,
    estimate_hours: parseEstimate(form.estimate_hours),
  });
  if (error) {
    saving.value = false;
    return;
  }
  await setSubtaskLabels(props.subtask.id, form.label_ids);
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
    :ui="{ content: 'sm:max-w-5xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="mb-4 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        <UButton
          v-for="tab in modalTabs"
          :key="tab.key"
          :variant="activeTab === tab.key ? 'solid' : 'ghost'"
          color="neutral"
          size="xs"
          class="shrink-0"
          @click="setActiveTab(tab.key)"
        >
          {{ tab.label }}
        </UButton>
      </div>

      <div v-if="activeTab === 'details'" class="space-y-4">
        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div class="flex flex-col gap-4 lg:min-h-[600px]">
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

            <UFormField :label="t('tasks.parentTask')">
              <USelectMenu
                v-model="form.task_id"
                :items="parentTaskItems"
                value-key="value"
                :placeholder="t('tasks.selectParentTask')"
                :search-input="{ placeholder: t('tasks.searchParentTask'), icon: 'i-lucide-search' }"
                class="w-full"
              />
            </UFormField>

            <UFormField :label="t('tasks.title')" required>
              <UInput
                v-model="form.title"
                :placeholder="t('tasks.addSubtask')"
                class="w-full"
              />
            </UFormField>

            <UFormField class="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col" :label="t('tasks.description')">
              <div class="min-h-0 lg:flex lg:flex-1">
                <RichTextEditor
                  v-model="form.description"
                  :placeholder="t('tasks.descriptionPlaceholder')"
                  :rows="6"
                  variant="full"
                  class="h-full w-full lg:min-h-[560px]"
                />
              </div>
            </UFormField>
          </div>

          <div class="space-y-4">
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

          <UFormField :label="t('tasks.startDate')">
            <UInput v-model="form.start_date" type="date" class="w-full" />
          </UFormField>

          <UFormField :label="t('tasks.dueDate')">
            <UInput v-model="form.due_date" type="date" class="w-full" />
          </UFormField>

          <UFormField :label="t('tasks.labels')">
            <USelect
              v-model="form.label_ids"
              :items="labelOptions"
              multiple
              :placeholder="t('tasks.selectLabels')"
              class="w-full"
            />
          </UFormField>
          </div>
        </div>
      </div>

      <TasksTaskComments
        v-else-if="activeTab === 'comments' && subtask"
        :task-id="subtask.task_id || parent?.id || form.task_id"
        :subtask-id="subtask.id"
      />

      <TasksTaskAttachments
        v-else-if="activeTab === 'attachments' && subtask"
        :task-id="subtask.task_id || parent?.id || form.task_id"
        :subtask-id="subtask.id"
      />

      <div v-else-if="activeTab === 'activity'" class="space-y-3">
        <div
          v-if="loadingActivity"
          class="flex items-center gap-2 py-6 text-sm text-slate-400"
        >
          <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
          <span>{{ t("common.loading") }}</span>
        </div>
        <template v-else>
          <div
            v-for="log in activity"
            :key="log.id"
            class="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
          >
            <span class="font-medium">
              {{ log.profiles?.full_name || log.profiles?.email || t("common.system") }}
            </span>
            <span class="text-slate-600">
              {{ actionLabel(log.action) }}
              <template v-if="log.field_name">
                {{ fieldLabel(log.field_name) }}:
                {{ resolveActivityValue(log.field_name, log.old_value) }}
                →
                {{ resolveActivityValue(log.field_name, log.new_value) }}
              </template>
            </span>
            <p class="text-xs text-slate-400">{{ toLocaleString(log.created_at) }}</p>
          </div>
          <p v-if="activity.length === 0" class="text-sm text-slate-400">{{ t("tasks.noActivity") }}</p>
        </template>
      </div>
    </template>

    <template v-if="activeTab === 'details'" #footer>
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
            :disabled="!form.title.trim() || !form.task_id || deleting"
            @click="save"
          >
            {{ t("common.save") }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
