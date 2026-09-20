<script setup lang="ts">
import type { Subtask, Task, TaskStatus, TaskPriority } from "~/types";
import { TASK_STATUS_VALUES } from "~/types";
import { addDays, format, parseISO } from "date-fns";
import {
  flattenProjectItems,
  projectItemDueDate,
  projectItemMatchesPerson,
  projectItemPriority,
  projectItemStatus,
  type ProjectItem,
} from "~/utils/projectItems";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const { dateFnsLocale } = useDateLocale();
const { statuses, priorities, statusLabel, priorityLabel, phaseFilterItems } = useTaskLabels();
const route = useRoute();
const projectId = computed(() => route.params.id as string);

const { getProject, fetchProjects } = useProjects();
const {
  tasks,
  loading,
  searchQuery,
  fetchTasks,
  bulkUpdateTasks,
  bulkSetLabels,
  bulkDeleteTasks,
} = useTasks(projectId);
const { fetchWorkspace, members, canManageMembers } = useWorkspace();
const { labels, fetchLabels } = useLabels();
const { confirm } = useConfirmDialog();
const toast = useToast();

const project = computed(() => getProject(projectId.value));
const statusFilter = ref<TaskStatus | "all">("all");
const priorityFilter = ref<TaskPriority | "all">("all");
const assigneeFilter = ref<string | "all">("all");
const phaseFilter = ref<string>("all");
const labelFilter = ref<string[]>([]);
const milestoneFilter = ref<string>("all");
const dueFilter = ref<"all" | "overdue" | "today" | "next7" | "none">("all");
const selectedIds = ref<Set<string>>(new Set());
const bulkLabelIds = ref<string[]>([]);
const bulkLabelMode = ref<"add" | "replace">("add");
const bulkAssignee = ref<string | null | undefined>(undefined);
const bulkTester = ref<string | null | undefined>(undefined);

const showModal = ref(false);
const showTemplateManager = ref(false);
const selectedTask = ref<Task | null>(null);
const showSubtaskModal = ref(false);
const selectedSubtask = ref<Subtask | null>(null);
const selectedSubtaskParent = ref<Task | null>(null);

onMounted(async () => {
  await fetchWorkspace();
  await fetchLabels();
  await fetchProjects();
  await fetchTasks(projectId.value);

  const statusQuery = route.query.status as string | undefined;
  if (statusQuery && TASK_STATUS_VALUES.includes(statusQuery as TaskStatus)) {
    statusFilter.value = statusQuery as TaskStatus;
  }
});

const filteredItems = computed(() => {
  const today = format(new Date(), "yyyy-MM-dd");
  const nextWeek = format(addDays(new Date(), 7), "yyyy-MM-dd");
  return flattenProjectItems(tasks.value).filter((item) => {
    if (statusFilter.value !== "all" && projectItemStatus(item) !== statusFilter.value) {
      return false;
    }
    if (
      priorityFilter.value !== "all" &&
      projectItemPriority(item) !== priorityFilter.value
    ) {
      return false;
    }
    if (assigneeFilter.value !== "all") {
      if (!projectItemMatchesPerson(item, assigneeFilter.value)) return false;
    }
    if (
      phaseFilter.value !== "all" &&
      ((item.kind === "task" ? item.task.phase : item.parent.phase) ?? "none") !==
        phaseFilter.value
    ) {
      return false;
    }
    if (labelFilter.value.length) {
      const itemLabels = item.kind === "task"
        ? item.task.task_labels?.map((tl) => tl.labels?.id).filter(Boolean)
        : item.subtask.subtask_labels?.map((sl) => sl.labels?.id).filter(Boolean);
      if (!labelFilter.value.some((id) => itemLabels?.includes(id))) return false;
    }
    if (milestoneFilter.value !== "all") {
      const milestoneId = item.kind === "task" ? item.task.milestone_id : item.parent.milestone_id;
      if (milestoneId !== milestoneFilter.value) return false;
    }
    const dueDate = projectItemDueDate(item);
    if (dueFilter.value === "overdue" && (!dueDate || dueDate >= today)) return false;
    if (dueFilter.value === "today" && dueDate !== today) return false;
    if (dueFilter.value === "next7" && (!dueDate || dueDate < today || dueDate > nextWeek)) return false;
    if (dueFilter.value === "none" && dueDate) return false;
    return true;
  });
});

const statusFilterItems = computed(() => [
  { label: t("projects.allStatus"), value: "all" },
  ...statuses.value.map((s) => ({ label: s.label, value: s.value })),
]);

const priorityFilterItems = computed(() => [
  { label: t("projects.allPriority"), value: "all" },
  ...priorities.value.map((p) => ({ label: p.label, value: p.value })),
]);

const assigneeFilterItems = computed(() => [
  { label: t("projects.allAssignees"), value: "all" },
  ...members.value.map((m) => ({
    label: m.profiles?.full_name || m.profiles?.email || "",
    value: m.user_id,
  })),
]);

const labelFilterItems = computed(() => labels.value.map((label) => ({ label: label.name, value: label.id })));
const milestoneFilterItems = computed(() => [
  { label: t("projects.allMilestones"), value: "all" },
  ...Array.from(
    new Map(
      tasks.value
        .map((task) => task.milestones)
        .filter((milestone): milestone is NonNullable<Task["milestones"]> => !!milestone)
        .map((milestone) => [milestone.id, milestone.title]),
    ),
  ).map(([value, label]) => ({ value, label })),
]);
const dueFilterItems = computed(() => [
  { label: t("projects.dueAll"), value: "all" },
  { label: t("projects.dueOverdue"), value: "overdue" },
  { label: t("projects.dueToday"), value: "today" },
  { label: t("projects.dueNext7"), value: "next7" },
  { label: t("projects.dueNone"), value: "none" },
]);
const bulkAssigneeItems = computed(() => [
  { label: t("tasks.unassigned"), value: null },
  ...members.value.map((member) => ({
    label: member.profiles?.full_name || member.profiles?.email || member.user_id,
    value: member.user_id,
  })),
]);
const bulkLabelItems = computed(() => labels.value.map((label) => ({ label: label.name, value: label.id })));
const selectedTaskIds = computed(() => [...selectedIds.value]);
const selectableItems = computed(() => filteredItems.value.filter((item) => item.kind === "task"));
const allVisibleSelected = computed(() =>
  selectableItems.value.length > 0 && selectableItems.value.every((item) => selectedIds.value.has(item.task.id)),
);
const hasActiveFilters = computed(() =>
  !!searchQuery.value || statusFilter.value !== "all" || priorityFilter.value !== "all" ||
  assigneeFilter.value !== "all" || phaseFilter.value !== "all" || labelFilter.value.length > 0 ||
  milestoneFilter.value !== "all" || dueFilter.value !== "all",
);

function toggleTask(id: string, checked: boolean) {
  const next = new Set(selectedIds.value);
  if (checked) next.add(id);
  else next.delete(id);
  selectedIds.value = next;
}

function toggleAll(checked: boolean) {
  selectedIds.value = checked ? new Set(selectableItems.value.map((item) => item.task.id)) : new Set();
}

function clearFilters() {
  searchQuery.value = "";
  statusFilter.value = "all";
  priorityFilter.value = "all";
  assigneeFilter.value = "all";
  phaseFilter.value = "all";
  labelFilter.value = [];
  milestoneFilter.value = "all";
  dueFilter.value = "all";
}

async function runBulk(update: Parameters<typeof bulkUpdateTasks>[1]) {
  const count = selectedTaskIds.value.length;
  const { error } = await bulkUpdateTasks(selectedTaskIds.value, update);
  if (error) {
    toast.add({ title: error, color: "error" });
    return;
  }
  selectedIds.value = new Set();
  toast.add({ title: t("projects.bulkDone", { count }), color: "success" });
}

async function runBulkLabels() {
  const count = selectedTaskIds.value.length;
  const { error } = await bulkSetLabels(selectedTaskIds.value, bulkLabelIds.value, bulkLabelMode.value);
  if (error) {
    toast.add({ title: error, color: "error" });
    return;
  }
  selectedIds.value = new Set();
  bulkLabelIds.value = [];
  toast.add({ title: t("projects.bulkDone", { count }), color: "success" });
}

async function runBulkDelete() {
  if (!canManageMembers.value) return;
  const count = selectedTaskIds.value.length;
  const ok = await confirm({
    title: t("projects.bulkDelete"),
    description: t("projects.bulkDeleteConfirm", { count }),
    confirmLabel: t("common.delete"),
    color: "error",
  });
  if (!ok) return;
  const { error } = await bulkDeleteTasks(selectedTaskIds.value);
  if (error) {
    toast.add({ title: error, color: "error" });
    return;
  }
  selectedIds.value = new Set();
  toast.add({ title: t("projects.bulkDeleted", { count }), color: "success" });
}

watch(searchQuery, () => fetchTasks(projectId.value));

function openTask(task: Task) {
  selectedTask.value = task;
  showSubtaskModal.value = false;
  showModal.value = true;
}

function openSubtask(payload: { subtask: Subtask; parent: Task }) {
  selectedSubtask.value = payload.subtask;
  selectedSubtaskParent.value = payload.parent;
  showModal.value = false;
  showSubtaskModal.value = true;
}

function openItem(item: ProjectItem) {
  if (item.kind === "task") openTask(item.task);
  else openSubtask({ subtask: item.subtask, parent: item.parent });
}

function openNew() {
  selectedTask.value = null;
  showSubtaskModal.value = false;
  showModal.value = true;
}

async function onSaved() {
  await fetchTasks(projectId.value);
  if (selectedSubtask.value) {
    const parent = tasks.value.find((t) => t.id === selectedSubtaskParent.value?.id);
    const fresh = parent?.subtasks?.find((s) => s.id === selectedSubtask.value?.id);
    selectedSubtask.value = fresh ?? null;
    selectedSubtaskParent.value = parent ?? null;
  }
}

function formatDueDate(date: string) {
  return format(parseISO(date), "d MMM yyyy", { locale: dateFnsLocale.value });
}

function personName(profile?: { full_name?: string | null; email?: string } | null) {
  return profile?.full_name || profile?.email || t("common.emDash");
}

function itemAssignee(item: ProjectItem) {
  return item.kind === "task" ? item.task.profiles : item.subtask.profiles;
}

function itemTester(item: ProjectItem) {
  return item.kind === "task" ? item.task.tester : item.subtask.tester;
}

function itemMilestone(item: ProjectItem) {
  return item.kind === "task"
    ? item.task.milestones?.title
    : item.parent.milestones?.title;
}
</script>

<template>
  <div class="p-4 md:p-6">
    <LayoutProjectHeader v-if="project" :project="project" :subtitle="t('projects.listSuffix')">
      <template #actions>
        <UButton icon="i-lucide-copy" size="sm" variant="soft" data-testid="template-manage" @click="showTemplateManager = true">
          {{ t("templates.manage") }}
        </UButton>
        <UButton icon="i-lucide-plus" size="sm" class="shrink-0" @click="openNew">
          {{ t("projects.addTask") }}
        </UButton>
      </template>
    </LayoutProjectHeader>

    <LayoutProjectNav class="mb-6" />

    <div class="mb-4 flex flex-wrap items-end gap-3">
      <UFormField :label="t('projects.searchPlaceholder')" class="w-full sm:w-64">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          :placeholder="t('projects.searchPlaceholder')"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('projects.filterStatus')" class="w-full sm:w-40">
        <USelect
          v-model="statusFilter"
          :items="statusFilterItems"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('projects.filterPriority')" class="w-full sm:w-40">
        <USelect
          v-model="priorityFilter"
          :items="priorityFilterItems"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('projects.filterAssignee')" class="w-full sm:w-48">
        <USelect
          v-model="assigneeFilter"
          :items="assigneeFilterItems"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('tasks.phaseLabel')" class="w-full sm:w-40">
        <USelect
          v-model="phaseFilter"
          :items="phaseFilterItems"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('projects.filterLabels')" class="w-full sm:w-48">
        <USelect v-model="labelFilter" :items="labelFilterItems" multiple class="w-full" data-testid="filter-labels" />
      </UFormField>
      <UFormField :label="t('projects.filterMilestone')" class="w-full sm:w-48">
        <USelect v-model="milestoneFilter" :items="milestoneFilterItems" class="w-full" data-testid="filter-milestone" />
      </UFormField>
      <UFormField :label="t('projects.filterDue')" class="w-full sm:w-40">
        <USelect v-model="dueFilter" :items="dueFilterItems" class="w-full" data-testid="filter-due" />
      </UFormField>
      <UButton v-if="hasActiveFilters" variant="link" color="neutral" data-testid="clear-filters" @click="clearFilters">
        {{ t("projects.clearFilters") }}
      </UButton>
    </div>

    <div v-if="selectedIds.size" class="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3" data-testid="bulk-toolbar">
      <span class="mr-1 text-sm font-medium text-blue-900" data-testid="bulk-count">
        {{ t("projects.bulkSelected", { count: selectedIds.size }) }}
      </span>
      <USelect
        :items="statusFilterItems.slice(1)"
        :placeholder="t('projects.bulkStatus')"
        class="w-36"
        data-testid="bulk-status"
        @update:model-value="(value) => runBulk({ status: value as TaskStatus })"
      />
      <USelect
        :items="priorityFilterItems.slice(1)"
        :placeholder="t('projects.bulkPriority')"
        class="w-36"
        data-testid="bulk-priority"
        @update:model-value="(value) => runBulk({ priority: value as TaskPriority })"
      />
      <USelectMenu
        :items="bulkAssigneeItems"
        value-key="value"
        :placeholder="t('projects.bulkAssignee')"
        class="w-44"
        data-testid="bulk-assignee"
        @update:model-value="(value) => runBulk({ assignee_id: value as string | null })"
      />
      <USelectMenu
        :items="bulkAssigneeItems"
        value-key="value"
        :placeholder="t('projects.bulkTester')"
        class="w-44"
        data-testid="bulk-tester"
        @update:model-value="(value) => runBulk({ tester_id: value as string | null })"
      />
      <USelect
        v-model="bulkLabelIds"
        :items="bulkLabelItems"
        multiple
        :placeholder="t('projects.bulkLabels')"
        class="w-44"
        data-testid="bulk-labels"
      />
      <USelect
        v-model="bulkLabelMode"
        :items="[
          { label: t('projects.bulkLabelsAdd'), value: 'add' },
          { label: t('projects.bulkLabelsReplace'), value: 'replace' },
        ]"
        class="w-32"
      />
      <UButton size="sm" :disabled="!bulkLabelIds.length" @click="runBulkLabels">
        {{ t("projects.bulkApplyLabels") }}
      </UButton>
      <UButton v-if="canManageMembers" size="sm" color="error" variant="soft" data-testid="bulk-delete" @click="runBulkDelete">
        {{ t("projects.bulkDelete") }}
      </UButton>
      <UButton size="sm" variant="ghost" color="neutral" @click="selectedIds = new Set()">
        {{ t("projects.bulkClear") }}
      </UButton>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-slate-400" />
    </div>

    <template v-else>
      <div class="space-y-2 md:hidden">
        <button
          v-for="item in filteredItems"
          :key="item.id"
          type="button"
          class="w-full rounded-xl border bg-white p-4 text-left transition-colors hover:bg-slate-50"
          :class="
            item.kind === 'subtask'
              ? 'border-dashed border-slate-300'
              : 'border-slate-200'
          "
          @click="openItem(item)"
        >
          <p
            v-if="item.kind === 'subtask'"
            class="mb-0.5 text-[11px] text-slate-400"
          >
            {{ t("tasks.subtaskOf", { title: item.parent.title }) }}
          </p>
          <p class="font-medium text-slate-800">
            {{ item.kind === "task" ? item.task.title : item.subtask.title }}
          </p>
          <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{{ statusLabel(projectItemStatus(item)) }}</span>
            <span>{{ priorityLabel(projectItemPriority(item)) }}</span>
            <span v-if="itemAssignee(item)">
              {{ t("tasks.devShort") }} {{ personName(itemAssignee(item)) }}
            </span>
            <span v-if="itemTester(item)">
              {{ t("tasks.testerShort") }} {{ personName(itemTester(item)) }}
            </span>
            <span v-if="itemMilestone(item)">{{ itemMilestone(item) }}</span>
            <span>
              {{
                projectItemDueDate(item)
                  ? formatDueDate(projectItemDueDate(item)!)
                  : t("common.emDash")
              }}
            </span>
          </div>
        </button>
        <p v-if="filteredItems.length === 0" class="py-8 text-center text-slate-400">
          {{ t("projects.noTasksFound") }}
        </p>
      </div>

      <div class="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table class="w-full min-w-[800px] text-sm">
           <thead class="border-b border-slate-200 bg-slate-50">
             <tr>
               <th class="w-10 px-3 py-3">
                 <UCheckbox data-testid="select-all" :model-value="allVisibleSelected" @update:model-value="(v) => toggleAll(!!v)" />
               </th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">{{ t("projects.colTitle") }}</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">{{ t("projects.colStatus") }}</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">{{ t("projects.colPriority") }}</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">{{ t("projects.colAssignee") }}</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">{{ t("projects.colTester") }}</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">{{ t("projects.colMilestone") }}</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">{{ t("projects.colDueDate") }}</th>
            </tr>
          </thead>
          <tbody>
             <tr
               v-for="item in filteredItems"
               :key="item.id"
               data-testid="task-row"
              class="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
              :class="item.kind === 'subtask' ? 'bg-slate-50/50' : ''"
               @click="openItem(item)"
             >
               <td class="w-10 px-3 py-3" @click.stop>
                 <UCheckbox
                   v-if="item.kind === 'task'"
                   :model-value="selectedIds.has(item.task.id)"
                   data-testid="row-checkbox"
                   @update:model-value="(v) => toggleTask(item.task.id, !!v)"
                 />
               </td>
              <td class="px-4 py-3 font-medium text-slate-800">
                <span
                  v-if="item.kind === 'subtask'"
                  class="mr-1.5 text-[11px] font-normal text-slate-400"
                >
                  ↳
                </span>
                {{ item.kind === "task" ? item.task.title : item.subtask.title }}
                <span
                  v-if="item.kind === 'subtask'"
                  class="mt-0.5 block text-[11px] font-normal text-slate-400"
                >
                  {{ t("tasks.subtaskOf", { title: item.parent.title }) }}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-600">{{ statusLabel(projectItemStatus(item)) }}</td>
              <td class="px-4 py-3 text-slate-600">{{ priorityLabel(projectItemPriority(item)) }}</td>
              <td class="px-4 py-3 text-slate-600">{{ personName(itemAssignee(item)) }}</td>
              <td class="px-4 py-3 text-slate-600">{{ personName(itemTester(item)) }}</td>
              <td class="px-4 py-3 text-slate-600">
                {{ itemMilestone(item) || t("common.emDash") }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{
                  projectItemDueDate(item)
                    ? formatDueDate(projectItemDueDate(item)!)
                    : t("common.emDash")
                }}
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="filteredItems.length === 0" class="p-8 text-center text-slate-400">
          {{ t("projects.noTasksFound") }}
        </p>
      </div>
    </template>

    <TasksTaskModal
      :task="selectedTask"
      :project-id="projectId"
      :open="showModal"
      @update:open="showModal = $event"
      @saved="onSaved"
    />
    <TasksTemplateManager v-model:open="showTemplateManager" />

    <TasksSubtaskModal
      :subtask="selectedSubtask"
      :parent="selectedSubtaskParent"
      :open="showSubtaskModal"
      @update:open="showSubtaskModal = $event"
      @saved="onSaved"
      @open-parent="openTask"
    />
  </div>
</template>
