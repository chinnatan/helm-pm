<script setup lang="ts">
import type {
  JobRole,
  Subtask,
  Task,
  TaskStatus,
  TaskPriority,
  TaskPhase,
} from "~/types";
import { PRIORITY_DEFAULT_HOURS, isTaskClosed, suggestPhaseForStatus, TASK_PHASE_VALUES } from "~/types";
import { format, parseISO } from "date-fns";
import { VueDraggable } from "vue-draggable-plus";

const props = defineProps<{
  task?: Task | null;
  projectId: string;
  open: boolean;
  defaultStatus?: TaskStatus;
  defaultDueDate?: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  saved: [];
}>();

const { t } = useI18n();
const { toLocaleString, dateFnsLocale } = useDateLocale();
const { statuses, priorities } = useTaskLabels();
const {
  tasks,
  createTask,
  updateTask,
  deleteTask,
  addSubtask,
  updateSubtask,
  toggleSubtask,
  deleteSubtask,
  reorderSubtasks,
  setTaskLabels,
  setSubtaskLabels,
  fetchActivity,
} = useTasks();
const { members, canManageMembers } = useWorkspace();
const { confirm } = useConfirmDialog();
const { labels, fetchLabels } = useLabels();
const projectIdRef = toRef(() => props.projectId);
const { milestones, fetchMilestones } = useMilestones(projectIdRef);
const { customers, fetchCustomers } = useCustomers();
const { getProject, fetchProjects, projects } = useProjects();
const { scheduleCapacityAlerts } = useCapacityAlerts();
const {
  addDependency,
  removeDependency,
  getDependsOn,
  getBlocks,
  wouldCreateCycle,
} = useDependencies(projectIdRef);

const form = reactive({
  title: "",
  description: "",
  parent_task_id: null as string | null,
  assignee_id: null as string | null,
  tester_id: null as string | null,
  milestone_id: null as string | null,
  customer_id: null as string | null,
  status: "todo" as TaskStatus,
  priority: "medium" as TaskPriority,
  phase: null as TaskPhase | null,
  due_date: "",
  start_date: "",
  estimate_hours: "" as string,
  label_ids: [] as string[],
});

const newSubtask = reactive({
  title: "",
  assignee_id: null as string | null,
  tester_id: null as string | null,
  start_date: "",
  due_date: "",
  estimate_hours: "",
});

const sortedSubtasks = ref<Subtask[]>([]);
const activity = ref<Awaited<ReturnType<typeof fetchActivity>>>([]);
const saving = ref(false);
const activeTab = ref("details");
const loadingActivity = ref(false);

const isEdit = computed(() => !!props.task);
const phaseTouched = ref(false);

watch(
  () => form.status,
  (status) => {
    if (phaseTouched.value) return;
    form.phase = suggestPhaseForStatus(status);
  },
);

function onPhaseChange(value: TaskPhase | null) {
  phaseTouched.value = true;
  form.phase = value;
}
const isCreateAsSubtask = computed(
  () => !isEdit.value && !!form.parent_task_id,
);

function setActiveTab(key: string) {
  activeTab.value = key;
  if (key === "activity" && props.task && activity.value.length === 0) {
    void loadActivity(props.task.id);
  }
}

function hydrateFormFromTask(task: Task) {
  phaseTouched.value = !!task.phase;
  form.title = task.title;
  form.description = task.description ?? "";
  form.parent_task_id = null;
  form.assignee_id = task.assignee_id;
  form.tester_id = task.tester_id;
  form.milestone_id = task.milestone_id;
  form.customer_id =
    task.customer_id ?? getProject(props.projectId)?.customer_id ?? null;
  form.status = task.status;
  form.priority = task.priority;
  form.phase = task.phase ?? null;
  form.due_date = task.due_date ?? "";
  form.start_date = task.start_date ?? "";
  form.estimate_hours =
    task.estimate_hours != null ? String(task.estimate_hours) : "";
  form.label_ids =
    (task.task_labels?.map((tl) => tl.labels?.id).filter(Boolean) as string[]) ??
    [];
  syncSortedSubtasks();
}

function hydrateFormForCreate() {
  phaseTouched.value = false;
  form.title = "";
  form.description = "";
  form.parent_task_id = null;
  form.assignee_id = null;
  form.tester_id = null;
  form.milestone_id = null;
  form.customer_id = getProject(props.projectId)?.customer_id ?? null;
  form.status = props.defaultStatus ?? "todo";
  form.priority = "medium";
  form.phase = null;
  form.due_date = props.defaultDueDate ?? "";
  form.start_date = "";
  form.estimate_hours = "";
  form.label_ids = [];
  activity.value = [];
  sortedSubtasks.value = [];
}

async function loadActivity(taskId: string) {
  loadingActivity.value = true;
  try {
    activity.value = await fetchActivity(taskId);
  } finally {
    loadingActivity.value = false;
  }
}

async function loadSupportingData() {
  await Promise.all([
    fetchLabels(),
    fetchMilestones(),
    fetchCustomers(),
    fetchProjects(),
  ]);
  // Re-resolve customer default once projects are available
  if (props.task && !props.task.customer_id && !form.customer_id) {
    form.customer_id = getProject(props.projectId)?.customer_id ?? null;
  } else if (!props.task && !form.customer_id) {
    form.customer_id = getProject(props.projectId)?.customer_id ?? null;
  }
}

const modalTabs = computed(() => [
  { key: "details", label: t("tasks.tabs.details") },
  { key: "comments", label: t("tasks.tabs.comments") },
  { key: "attachments", label: t("tasks.tabs.attachments") },
  { key: "activity", label: t("tasks.tabs.activity") },
]);

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

const milestoneTitleById = computed(() => {
  const map = new Map<string, string>();
  for (const ms of milestones.value) {
    map.set(ms.id, ms.title);
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

function syncSortedSubtasks() {
  sortedSubtasks.value = [...(props.task?.subtasks ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
}

function parseEstimate(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resetNewSubtask() {
  newSubtask.title = "";
  newSubtask.assignee_id = null;
  newSubtask.tester_id = null;
  newSubtask.start_date = "";
  newSubtask.due_date = "";
  newSubtask.estimate_hours = "";
}

const newSubtaskMore = ref(false);
const showSubtaskDetail = ref(false);
const detailSubtask = ref<Subtask | null>(null);

function subtaskDateShort(iso: string | null | undefined) {
  if (!iso) return null;
  return format(parseISO(iso), "d MMM", { locale: dateFnsLocale.value });
}

function openSubtaskDetail(sub: Subtask) {
  detailSubtask.value = sub;
  showSubtaskDetail.value = true;
}

async function renameSubtask(sub: Subtask, raw: string) {
  const title = raw.trim();
  if (!title || title === sub.title) return;
  await updateSubtask(sub.id, { title });
  syncSortedSubtasks();
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;

    activeTab.value = "details";
    resetNewSubtask();
    newSubtaskMore.value = false;

    // Hydrate immediately so edit doesn't flash as "new task"
    if (props.task) {
      hydrateFormFromTask(props.task);
      activity.value = [];
    } else {
      hydrateFormForCreate();
    }

    void loadSupportingData();
  },
);

watch(
  () => props.task?.id,
  (id) => {
    if (!props.open || !id || !props.task) return;
    hydrateFormFromTask(props.task);
    activity.value = [];
    if (activeTab.value === "activity") void loadActivity(id);
  },
);

watch(
  () => props.task?.subtasks,
  () => {
    if (props.open && props.task) syncSortedSubtasks();
  },
  { deep: true },
);

async function save() {
  saving.value = true;

  const estimate_hours = parseEstimate(form.estimate_hours);

  if (isEdit.value && props.task) {
    await updateTask(props.task.id, {
      title: form.title,
      description: form.description || undefined,
      assignee_id: form.assignee_id || null,
      tester_id: form.tester_id || null,
      milestone_id: form.milestone_id || null,
      customer_id: form.customer_id || null,
      status: form.status,
      priority: form.priority,
      phase: form.phase,
      due_date: form.due_date || null,
      start_date: form.start_date || null,
      estimate_hours,
    });
    await setTaskLabels(props.task.id, form.label_ids);
  } else if (form.parent_task_id) {
    const { data, error } = await addSubtask(form.parent_task_id, form.title, {
      description: form.description || null,
      status: form.status,
      assignee_id: form.assignee_id || null,
      tester_id: form.tester_id || null,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
      estimate_hours,
    });
    if (!error && data && form.label_ids.length) {
      await setSubtaskLabels(data.id, form.label_ids);
    }
  } else {
    const { data } = await createTask({
      project_id: props.projectId,
      title: form.title,
      description: form.description || undefined,
      assignee_id: form.assignee_id || null,
      tester_id: form.tester_id || null,
      milestone_id: form.milestone_id || null,
      customer_id: form.customer_id || null,
      status: form.status,
      priority: form.priority,
      phase: form.phase,
      due_date: form.due_date || null,
      start_date: form.start_date || null,
      estimate_hours,
    });
    if (data && form.label_ids.length) {
      await setTaskLabels(data.id, form.label_ids);
    }
  }

  saving.value = false;
  emit("update:open", false);
  emit("saved");
  scheduleCapacityAlerts({ projects: projects.value });
}

const deleting = ref(false);

async function handleDelete() {
  if (!props.task || !canManageMembers.value) return;
  const ok = await confirm({
    title: t("tasks.delete"),
    description: t("tasks.deleteConfirm"),
    confirmLabel: t("common.delete"),
    color: "error",
  });
  if (!ok) return;
  deleting.value = true;
  const { error } = await deleteTask(props.task.id);
  deleting.value = false;
  if (error) return;
  emit("update:open", false);
  emit("saved");
  scheduleCapacityAlerts({ projects: projects.value });
}

const defaultEstimateHours = computed(
  () => PRIORITY_DEFAULT_HOURS[form.priority] ?? PRIORITY_DEFAULT_HOURS.medium,
);

async function handleAddSubtask() {
  if (!props.task) return;
  const titles = newSubtask.title
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!titles.length) return;

  const opts = {
    assignee_id: newSubtask.assignee_id,
    tester_id: newSubtask.tester_id,
    start_date: newSubtask.start_date || null,
    due_date: newSubtask.due_date || null,
    estimate_hours: parseEstimate(newSubtask.estimate_hours),
  };
  for (const title of titles) {
    await addSubtask(props.task.id, title, opts);
  }

  // คง field อื่นไว้เพื่อกรอกต่อเนื่อง ล้างเฉพาะ title
  newSubtask.title = "";
  syncSortedSubtasks();
  scheduleCapacityAlerts({ projects: projects.value });
}

function onNewSubtaskPaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData("text/plain") ?? "";
  if (!text.includes("\n")) return;
  event.preventDefault();
  newSubtask.title = text;
  void handleAddSubtask();
}

async function onSubtaskAssignee(sub: Subtask, value: string | null) {
  await updateSubtask(sub.id, { assignee_id: value });
  scheduleCapacityAlerts({ projects: projects.value });
}

async function onSubtaskTester(sub: Subtask, value: string | null) {
  await updateSubtask(sub.id, { tester_id: value });
}

async function onSubtaskStartDate(sub: Subtask, value: string) {
  await updateSubtask(sub.id, { start_date: value || null });
}

async function onSubtaskDueDate(sub: Subtask, value: string) {
  await updateSubtask(sub.id, { due_date: value || null });
  scheduleCapacityAlerts({ projects: projects.value });
}

async function onSubtaskEstimate(sub: Subtask, value: string) {
  await updateSubtask(sub.id, { estimate_hours: parseEstimate(value) });
  scheduleCapacityAlerts({ projects: projects.value });
}

async function handleDeleteSubtask(sub: Subtask) {
  const ok = await confirm({
    title: t("tasks.deleteSubtask"),
    description: t("tasks.deleteSubtaskConfirm"),
    confirmLabel: t("common.delete"),
    color: "error",
  });
  if (!ok) return;
  await deleteSubtask(sub.id);
  syncSortedSubtasks();
  scheduleCapacityAlerts({ projects: projects.value });
}

async function onSubtasksReorder() {
  if (!props.task) return;
  await reorderSubtasks(
    props.task.id,
    sortedSubtasks.value.map((s) => s.id),
  );
}

function subtaskTitleById(subtaskId: string | null | undefined) {
  if (!subtaskId) return null;
  return props.task?.subtasks?.find((s) => s.id === subtaskId)?.title ?? null;
}

function resolveActivityValue(field: string | null, value: string | null) {
  if (!value) return t("common.none");
  if (
    field === "assignee_id" ||
    field === "tester_id" ||
    field === "subtask_assignee_id" ||
    field === "subtask_tester_id"
  ) {
    return profileNameById.value.get(value) ?? value;
  }
  if (field === "milestone_id") {
    return milestoneTitleById.value.get(value) ?? value;
  }
  if (field === "task_id") {
    return tasks.value.find((t) => t.id === value)?.title ?? value;
  }
  if (field === "status") {
    return t(`status.${value}`);
  }
  if (field === "priority") {
    return t(`priority.${value}`);
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

const labelOptions = computed(() =>
  labels.value.map((l) => ({ label: l.name, value: l.id })),
);

const parentTaskItems = computed(() => [
  { label: t("tasks.noParentTask"), value: null },
  ...tasks.value.map((task) => ({
    label: task.title,
    value: task.id,
  })),
]);

const statusItems = computed(() =>
  statuses.value.map((s) => ({ label: s.label, value: s.value })),
);

const priorityItems = computed(() =>
  priorities.value.map((p) => ({ label: p.label, value: p.value })),
);

const phaseItems = computed(() => [
  { label: t("tasks.phaseNone"), value: null },
  ...TASK_PHASE_VALUES.map((p) => ({
    label: t(`tasks.phase.${p.value}`),
    value: p.value,
  })),
]);

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

const milestoneItems = computed(() => [
  { label: t("common.none"), value: null },
  ...milestones.value.map((m) => ({
    label: `${m.title} (${m.start_date || m.date} → ${m.due_date || m.date})`,
    value: m.id,
  })),
]);

const customerItems = computed(() => [
  { label: t("common.none"), value: null },
  ...customers.value
    .filter((c) => c.status === "active")
    .map((c) => ({ label: formatCustomerLabel(c), value: c.id })),
]);

const newDependency = ref<string | undefined>(undefined);
const depError = ref<string | null>(null);

const dependsOnList = computed(() => {
  const id = props.task?.id;
  if (!id) return [];
  return getDependsOn(id)
    .map((d) => ({ depId: d.id, task: tasks.value.find((t) => t.id === d.depends_on_task_id) }))
    .filter((x): x is { depId: string; task: Task } => !!x.task);
});

const blocksList = computed(() => {
  const id = props.task?.id;
  if (!id) return [];
  return getBlocks(id)
    .map((d) => tasks.value.find((t) => t.id === d.task_id))
    .filter((t): t is Task => !!t);
});

const dependencyOptions = computed(() => {
  const id = props.task?.id;
  const selected = new Set(dependsOnList.value.map((d) => d.task.id));
  return tasks.value
    .filter((t) => t.id !== id && !selected.has(t.id) && !isTaskClosed(t.status))
    .map((t) => ({ label: t.title, value: t.id }));
});

async function handleAddDependency(value?: string | null) {
  if (!props.task || !value) return;
  depError.value = null;
  if (wouldCreateCycle(props.task.id, value)) {
    depError.value = t("tasks.depErrCircular");
    newDependency.value = undefined;
    return;
  }
  const { error } = await addDependency(props.task.id, value);
  if (error) depError.value = error;
  newDependency.value = undefined;
}

async function handleRemoveDependency(depId: string) {
  depError.value = null;
  await removeDependency(depId);
}

watch(
  () => props.task?.id,
  () => {
    newDependency.value = undefined;
    depError.value = null;
  },
);
</script>

<template>
  <UModal
    :open="open"
    :title="isEdit ? t('tasks.editTask') : isCreateAsSubtask ? t('tasks.newSubtask') : t('tasks.newTask')"
    :fullscreen="isMobile"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div
        v-if="isEdit"
        class="mb-4 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2"
      >
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

      <div v-if="activeTab === 'details' || !isEdit" class="space-y-4">
        <UFormField v-if="!isEdit" :label="t('tasks.parentTask')">
          <USelectMenu
            v-model="form.parent_task_id"
            :items="parentTaskItems"
            value-key="value"
            :placeholder="t('tasks.selectParentTask')"
            :search-input="{ placeholder: t('tasks.searchParentTask'), icon: 'i-lucide-search' }"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('tasks.title')" required>
          <UInput v-model="form.title" :placeholder="t('tasks.titlePlaceholder')" class="w-full" />
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

          <UFormField :label="t('tasks.status')">
            <USelect
              v-model="form.status"
              :items="statusItems"
              class="w-full"
            />
          </UFormField>

          <UFormField v-if="!isCreateAsSubtask" :label="t('tasks.priority')">
            <USelect
              v-model="form.priority"
              :items="priorityItems"
              class="w-full"
            />
          </UFormField>

          <UFormField v-if="!isCreateAsSubtask" :label="t('tasks.phaseLabel')">
            <USelect
              :model-value="form.phase"
              :items="phaseItems"
              class="w-full"
              @update:model-value="(v) => onPhaseChange(v as TaskPhase | null)"
            />
          </UFormField>

          <UFormField :label="t('tasks.startDate')">
            <UInput v-model="form.start_date" type="date" class="w-full" />
          </UFormField>

          <UFormField :label="t('tasks.dueDate')">
            <UInput v-model="form.due_date" type="date" class="w-full" />
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

          <UFormField v-if="!isCreateAsSubtask" :label="t('projects.milestone')">
            <USelect
              v-model="form.milestone_id"
              :items="milestoneItems"
              :placeholder="t('projects.selectMilestone')"
              class="w-full"
            />
          </UFormField>

          <UFormField v-if="!isCreateAsSubtask" :label="t('projects.customer')">
            <USelect
              v-model="form.customer_id"
              :items="customerItems"
              :placeholder="t('projects.selectCustomer')"
              class="w-full"
            />
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

        <UFormField v-if="isEdit && task" :label="t('tasks.subtasks')">
          <div class="space-y-1.5">
            <VueDraggable
              v-model="sortedSubtasks"
              handle=".subtask-drag-handle"
              :animation="150"
              class="space-y-1.5"
              @end="onSubtasksReorder"
            >
              <div
                v-for="sub in sortedSubtasks"
                :key="sub.id"
                class="flex items-start gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 hover:border-slate-300"
              >
                <button
                  type="button"
                  class="subtask-drag-handle mt-1 shrink-0 cursor-grab text-slate-300 hover:text-slate-600 active:cursor-grabbing"
                  :aria-label="t('tasks.reorderSubtask')"
                >
                  <UIcon name="i-lucide-grip-vertical" class="size-4" />
                </button>
                <UCheckbox
                  class="mt-1"
                  :model-value="sub.completed"
                  @update:model-value="(v) => toggleSubtask(sub.id, !!v)"
                />
                <div class="min-w-0 flex-1">
                  <input
                    :value="sub.title"
                    type="text"
                    class="w-full truncate rounded bg-transparent text-sm outline-none hover:bg-slate-50 focus:bg-slate-50 focus:ring-1 focus:ring-slate-200"
                    :class="sub.completed ? 'text-slate-400 line-through' : 'text-slate-700'"
                    :aria-label="t('tasks.renameSubtask')"
                    @change="
                      (e: Event) => renameSubtask(sub, (e.target as HTMLInputElement).value)
                    "
                    @keyup.enter="(e: KeyboardEvent) => (e.target as HTMLInputElement).blur()"
                  />
                  <div
                    v-if="sub.profiles || sub.due_date || sub.estimate_hours != null"
                    class="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-400"
                  >
                    <span v-if="sub.profiles" class="flex items-center gap-1">
                      <UIcon name="i-lucide-user" class="size-3" />
                      {{ sub.profiles.full_name || sub.profiles.email }}
                    </span>
                    <span v-if="sub.due_date" class="flex items-center gap-1">
                      <UIcon name="i-lucide-calendar" class="size-3" />
                      {{ subtaskDateShort(sub.due_date) }}
                    </span>
                    <span v-if="sub.estimate_hours != null">{{ sub.estimate_hours }}h</span>
                  </div>
                </div>
                <UPopover>
                  <UButton
                    icon="i-lucide-sliders-horizontal"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    class="mt-0.5 shrink-0"
                    :aria-label="t('tasks.subtaskMoreOptions')"
                  />
                  <template #content>
                    <div class="w-64 space-y-2 p-3">
                      <USelect
                        :model-value="sub.assignee_id"
                        :items="developerItems"
                        :placeholder="t('tasks.selectAssignee')"
                        size="sm"
                        class="w-full"
                        @update:model-value="(v) => onSubtaskAssignee(sub, v as string | null)"
                      />
                      <USelect
                        :model-value="sub.tester_id"
                        :items="testerItems"
                        :placeholder="t('tasks.selectTester')"
                        size="sm"
                        class="w-full"
                        @update:model-value="(v) => onSubtaskTester(sub, v as string | null)"
                      />
                      <UInput
                        :model-value="sub.start_date ?? ''"
                        type="date"
                        size="sm"
                        class="w-full"
                        @update:model-value="(v) => onSubtaskStartDate(sub, String(v ?? ''))"
                      />
                      <UInput
                        :model-value="sub.due_date ?? ''"
                        type="date"
                        size="sm"
                        class="w-full"
                        @update:model-value="(v) => onSubtaskDueDate(sub, String(v ?? ''))"
                      />
                      <UInput
                        :model-value="sub.estimate_hours != null ? String(sub.estimate_hours) : ''"
                        type="number"
                        min="0.5"
                        step="0.5"
                        size="sm"
                        class="w-full"
                        :placeholder="t('tasks.estimateHoursPlaceholder')"
                        @change="
                          (e: Event) =>
                            onSubtaskEstimate(sub, (e.target as HTMLInputElement).value)
                        "
                      />
                    </div>
                  </template>
                </UPopover>
                <UButton
                  icon="i-lucide-maximize-2"
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  class="mt-0.5 shrink-0"
                  :aria-label="t('tasks.editSubtask')"
                  @click="openSubtaskDetail(sub)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  variant="ghost"
                  color="error"
                  size="xs"
                  class="mt-0.5 shrink-0"
                  :aria-label="t('tasks.deleteSubtask')"
                  @click="handleDeleteSubtask(sub)"
                />
              </div>
            </VueDraggable>

            <div class="space-y-2 rounded-lg border border-dashed border-slate-300 p-2">
              <UInput
                v-model="newSubtask.title"
                :placeholder="t('tasks.addSubtask')"
                class="w-full"
                @keyup.enter="handleAddSubtask"
                @paste="onNewSubtaskPaste"
              />
              <div v-if="newSubtaskMore" class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <USelect
                  v-model="newSubtask.assignee_id"
                  :items="developerItems"
                  :placeholder="t('tasks.selectAssignee')"
                  size="sm"
                  class="w-full"
                />
                <USelect
                  v-model="newSubtask.tester_id"
                  :items="testerItems"
                  :placeholder="t('tasks.selectTester')"
                  size="sm"
                  class="w-full"
                />
                <UInput v-model="newSubtask.start_date" type="date" size="sm" class="w-full" />
                <UInput v-model="newSubtask.due_date" type="date" size="sm" class="w-full" />
                <UInput
                  v-model="newSubtask.estimate_hours"
                  type="number"
                  min="0.5"
                  step="0.5"
                  size="sm"
                  class="w-full"
                  :placeholder="t('tasks.estimateHoursPlaceholder')"
                />
              </div>
              <div class="flex items-center gap-2">
                <UButton
                  size="sm"
                  icon="i-lucide-plus"
                  :disabled="!newSubtask.title.trim()"
                  @click="handleAddSubtask"
                >
                  {{ t("common.add") }}
                </UButton>
                <UButton
                  size="xs"
                  variant="link"
                  color="neutral"
                  :label="newSubtaskMore ? t('tasks.hideDetails') : t('tasks.showDetails')"
                  @click="newSubtaskMore = !newSubtaskMore"
                />
              </div>
              <p class="text-[11px] text-slate-400">{{ t("tasks.subtaskBulkHint") }}</p>
            </div>
          </div>
        </UFormField>

        <UFormField v-if="isEdit && task" :label="t('tasks.dependencies')">
          <div class="space-y-3">
            <div>
              <p class="mb-1.5 text-xs font-medium text-slate-500">
                {{ t("tasks.dependsOn") }}
              </p>
              <div v-if="dependsOnList.length" class="flex flex-col gap-1.5">
                <div
                  v-for="d in dependsOnList"
                  :key="d.depId"
                  class="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5"
                >
                  <div class="flex min-w-0 items-center gap-2">
                    <UIcon
                      :name="
                        isTaskClosed(d.task.status)
                          ? 'i-lucide-circle-check'
                          : 'i-lucide-clock'
                      "
                      class="size-4 shrink-0"
                      :class="isTaskClosed(d.task.status) ? 'text-green-500' : 'text-amber-500'"
                    />
                    <span class="truncate text-sm text-slate-700">{{ d.task.title }}</span>
                    <span class="shrink-0 text-[11px] text-slate-400">
                      {{
                        isTaskClosed(d.task.status)
                          ? t("tasks.dependencyStatusDone")
                          : t("tasks.dependencyStatusOpen")
                      }}
                    </span>
                  </div>
                  <UButton
                    icon="i-lucide-x"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    :aria-label="t('common.delete')"
                    @click="handleRemoveDependency(d.depId)"
                  />
                </div>
              </div>
              <p v-else class="text-xs text-slate-400">{{ t("tasks.dependenciesHint") }}</p>

              <USelectMenu
                v-model="newDependency"
                :items="dependencyOptions"
                value-key="value"
                :placeholder="t('tasks.addDependency')"
                :search-input="{
                  placeholder: t('tasks.addDependency'),
                  icon: 'i-lucide-search',
                }"
                class="mt-2 w-full"
                @update:model-value="handleAddDependency"
              />
              <p v-if="depError" class="mt-1 text-xs text-red-500">{{ depError }}</p>
            </div>

            <div>
              <p class="mb-1.5 text-xs font-medium text-slate-500">{{ t("tasks.blocks") }}</p>
              <div v-if="blocksList.length" class="flex flex-col gap-1.5">
                <div
                  v-for="b in blocksList"
                  :key="b.id"
                  class="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5"
                >
                  <UIcon
                    :name="isTaskClosed(b.status) ? 'i-lucide-circle-check' : 'i-lucide-clock'"
                    class="size-4 shrink-0"
                    :class="isTaskClosed(b.status) ? 'text-green-500' : 'text-amber-500'"
                  />
                  <span class="truncate text-sm text-slate-700">{{ b.title }}</span>
                </div>
              </div>
              <p v-else class="text-xs text-slate-400">{{ t("tasks.noDependencies") }}</p>
            </div>
          </div>
        </UFormField>
      </div>

      <TasksTaskComments
        v-else-if="activeTab === 'comments' && task"
        :task-id="task.id"
      />

      <TasksTaskAttachments
        v-else-if="activeTab === 'attachments' && task"
        :task-id="task.id"
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
              <template v-if="log.subtask_id">
                {{ t("tasks.activitySubtaskPrefix", { title: subtaskTitleById(log.subtask_id) || "…" }) }}
              </template>
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

    <template v-if="activeTab === 'details' || !isEdit" #footer>
      <div class="flex items-center justify-between gap-2">
        <UButton
          v-if="isEdit && canManageMembers"
          variant="ghost"
          color="error"
          :loading="deleting"
          :disabled="saving"
          @click="handleDelete"
        >
          {{ t("tasks.delete") }}
        </UButton>
        <div v-else />
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="emit('update:open', false)">
            {{ t("common.cancel") }}
          </UButton>
          <UButton :loading="saving" :disabled="!form.title || deleting" @click="save">
            {{ isEdit ? t("common.save") : t("common.create") }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>

  <TasksSubtaskModal
    :subtask="detailSubtask"
    :parent="task ?? null"
    :open="showSubtaskDetail"
    @update:open="showSubtaskDetail = $event"
    @saved="syncSortedSubtasks"
  />
</template>
