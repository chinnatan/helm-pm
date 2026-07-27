<script setup lang="ts">
import type { Task } from "~/types";
import { isTaskClosed, PROJECT_COLORS } from "~/types";
import { format, parseISO, isBefore, startOfDay } from "date-fns";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const { dateFnsLocale } = useDateLocale();
const route = useRoute();
const user = useSupabaseUser();
const projectId = computed(() => route.params.id as string);

const { getProject, fetchProjects, updateProject, projects } = useProjects();
const { tasks, fetchTasks } = useTasks(projectId);
const { fetchWorkspace, members, canManageMembers, myMembership } = useWorkspace();
const { fetchCustomers } = useCustomers();
const {
  fetchCapacityData,
  projectAssigneeLoads,
  upcomingMilestones,
} = useTeamCapacity();
const projectIdRef = toRef(() => projectId.value);
const { milestones, fetchMilestones } = useMilestones(projectIdRef);
const { scheduleCapacityAlerts } = useCapacityAlerts();

const project = computed(() => getProject(projectId.value));
const showModal = ref(false);
const selectedTask = ref<Task | null>(null);
const showEdit = ref(false);
const savingEdit = ref(false);
const editError = ref("");

const editName = ref("");
const editDescription = ref("");
const editColor = ref(PROJECT_COLORS[0]!);
const editOwnerId = ref<string | null>(null);

const assigneeLoads = computed(() => projectAssigneeLoads(projectId.value));
const nearMilestones = computed(() => upcomingMilestones(milestones.value, 3));

const projectRemainingHours = computed(() =>
  assigneeLoads.value.reduce((s, r) => s + r.remainingHours, 0),
);

const canEditProject = computed(() => {
  if (!project.value) return false;
  if (project.value.owner_id && project.value.owner_id === user.value?.id) return true;
  const role = myMembership.value?.role;
  return role === "admin" || role === "manager" || role === "member";
});

const ownerItems = computed(() => [
  { label: t("projects.ownerUnassigned"), value: null },
  ...members.value.map((member) => ({
    label: member.profiles?.full_name || member.profiles?.email || t("common.none"),
    value: member.user_id,
  })),
]);

onMounted(async () => {
  await fetchWorkspace();
  await Promise.all([fetchProjects(), fetchCustomers()]);
  await Promise.all([fetchTasks(projectId.value), fetchMilestones(), fetchCapacityData()]);
  scheduleCapacityAlerts({ projects: projects.value });
  if (route.query.edit === "1" && canEditProject.value) {
    openEditProject();
    navigateTo({ path: route.path, query: {} }, { replace: true });
  }
});

function openEditProject() {
  if (!project.value) return;
  editName.value = project.value.name;
  editDescription.value = project.value.description ?? "";
  editColor.value = project.value.color || PROJECT_COLORS[0]!;
  editOwnerId.value = project.value.owner_id;
  editError.value = "";
  showEdit.value = true;
}

async function handleSaveProject() {
  if (!project.value || !editName.value.trim()) return;
  savingEdit.value = true;
  editError.value = "";

  const { error } = await updateProject(project.value.id, {
    name: editName.value.trim(),
    description: editDescription.value.trim() || null,
    color: editColor.value,
    owner_id: editOwnerId.value,
  });

  savingEdit.value = false;

  if (error) {
    editError.value = error;
    return;
  }

  showEdit.value = false;
}

const stats = computed(() => ({
  total: tasks.value.length,
  inProgress: tasks.value.filter((t) => t.status === "in_progress").length,
  testing: tasks.value.filter(
    (t) => t.status === "ready_for_test" || t.status === "testing",
  ).length,
  done: tasks.value.filter((t) => t.status === "done" || t.status === "release").length,
}));

const overdueTasks = computed(() => {
  const today = startOfDay(new Date());
  return tasks.value
    .filter((task) => {
      if (!task.due_date || isTaskClosed(task.status)) return false;
      return isBefore(parseISO(task.due_date), today);
    })
    .slice(0, 5);
});

function listLink(status?: string) {
  return {
    path: `/projects/${projectId.value}/list`,
    query: status ? { status } : undefined,
  };
}

function openTask(task: Task) {
  selectedTask.value = task;
  showModal.value = true;
}

function openNewTask() {
  selectedTask.value = null;
  showModal.value = true;
}

async function onTaskSaved() {
  await fetchTasks(projectId.value);
  await fetchCapacityData();
  scheduleCapacityAlerts({ projects: projects.value });
}

function formatDue(date: string) {
  return format(parseISO(date), "d MMM", { locale: dateFnsLocale.value });
}
</script>

<template>
  <div class="p-4 md:p-6">
    <LayoutProjectHeader v-if="project" :project="project">
      <template #actions>
        <UButton
          v-if="canEditProject"
          icon="i-lucide-pencil"
          size="sm"
          variant="soft"
          color="neutral"
          class="shrink-0"
          @click="openEditProject"
        >
          {{ t("projects.editProject") }}
        </UButton>
        <UButton
          icon="i-lucide-plus"
          size="sm"
          class="shrink-0"
          @click="openNewTask"
        >
          {{ t("projects.addTask") }}
        </UButton>
      </template>
    </LayoutProjectHeader>

    <RichTextContent
      v-if="project?.description"
      class="mb-4 -mt-2 text-slate-500"
      :content="project.description"
    />

    <div v-if="project" class="mb-4 grid max-w-2xl gap-4 sm:grid-cols-2">
      <div>
        <p class="mb-1 text-xs font-medium text-slate-500">{{ t("projects.owner") }}</p>
        <p class="text-sm text-slate-800">
          {{
            project.owner?.full_name
              || project.owner?.email
              || t("projects.ownerUnassigned")
          }}
        </p>
      </div>
    </div>

    <LayoutProjectNav class="mb-6" />

    <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <NuxtLink
        :to="listLink()"
        class="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
      >
        <p class="text-sm text-slate-500">{{ t("projects.statsTotal") }}</p>
        <p class="text-2xl font-bold text-slate-900">{{ stats.total }}</p>
      </NuxtLink>
      <NuxtLink
        :to="listLink('in_progress')"
        class="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
      >
        <p class="text-sm text-slate-500">{{ t("status.in_progress") }}</p>
        <p class="text-2xl font-bold text-blue-600">{{ stats.inProgress }}</p>
      </NuxtLink>
      <NuxtLink
        :to="listLink('testing')"
        class="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
      >
        <p class="text-sm text-slate-500">{{ t("status.testing") }}</p>
        <p class="text-2xl font-bold text-amber-600">{{ stats.testing }}</p>
      </NuxtLink>
      <NuxtLink
        :to="listLink('done')"
        class="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
      >
        <p class="text-sm text-slate-500">{{ t("status.done") }}</p>
        <p class="text-2xl font-bold text-green-600">{{ stats.done }}</p>
      </NuxtLink>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-slate-700">{{ t("projects.overdueTasks") }}</h2>
        <NuxtLink
          :to="`/projects/${projectId}/board`"
          class="text-xs text-slate-500 hover:text-slate-800"
        >
          {{ t("projectNav.board") }}
        </NuxtLink>
      </div>
      <p v-if="overdueTasks.length === 0" class="text-sm text-slate-400">
        {{ t("projects.noOverdue") }}
      </p>
      <div v-else class="space-y-2">
        <button
          v-for="task in overdueTasks"
          :key="task.id"
          type="button"
          class="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
          @click="openTask(task)"
        >
          <span class="truncate text-sm font-medium text-slate-800">{{ task.title }}</span>
          <span class="shrink-0 text-xs text-red-500">{{ formatDue(task.due_date || "") }}</span>
        </button>
      </div>
    </div>

    <div class="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div class="mb-1 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 class="text-sm font-semibold text-slate-700">
            {{ t("capacity.projectTitle") }}
          </h2>
          <p class="text-xs text-slate-400">{{ t("capacity.projectHint") }}</p>
        </div>
        <p class="text-sm text-slate-600">
          {{ t("capacity.remainingHours") }}:
          <span class="font-semibold text-slate-900">
            {{ Math.round(projectRemainingHours * 10) / 10 }}
            {{ t("capacity.hoursUnit") }}
          </span>
        </p>
      </div>

      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {{ t("capacity.assigneeLoad") }}
          </h3>
          <p v-if="assigneeLoads.length === 0" class="text-sm text-slate-400">
            {{ t("capacity.noAssignees") }}
          </p>
          <div v-else class="space-y-3">
            <div
              v-for="row in assigneeLoads"
              :key="row.userId"
              class="rounded-lg border border-slate-100 p-3"
            >
              <div class="mb-2 flex items-center justify-between gap-2">
                <p class="truncate text-sm font-medium text-slate-800">{{ row.name }}</p>
                <p class="shrink-0 text-xs text-slate-500">
                  {{ row.remainingHours }}{{ t("capacity.hoursUnit") }} ·
                  {{ row.activeTaskCount }}
                </p>
              </div>
              <CapacityLoadBar
                :pct="row.thisWeekPct"
                :label="`${t('capacity.thisWeek')} · ${row.thisWeekHours}${t('capacity.hoursUnit')}`"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {{ t("capacity.upcomingMilestones") }}
          </h3>
          <p v-if="nearMilestones.length === 0" class="text-sm text-slate-400">
            {{ t("capacity.noMilestones") }}
          </p>
          <ul v-else class="space-y-2">
            <li
              v-for="ms in nearMilestones"
              :key="ms.id"
              class="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
            >
              <span class="truncate text-sm font-medium text-slate-800">{{ ms.title }}</span>
              <span class="shrink-0 text-xs text-slate-500">
                {{ formatDue(ms.due_date || ms.date) }}
              </span>
            </li>
          </ul>
          <NuxtLink
            :to="`/projects/${projectId}/gantt`"
            class="mt-3 inline-block text-xs text-slate-500 hover:text-slate-800"
          >
            {{ t("projectNav.gantt") }}
          </NuxtLink>
        </div>
      </div>
    </div>

    <UModal v-model:open="showEdit" :title="t('projects.editProject')">
      <template #body>
        <div class="space-y-4">
          <UAlert v-if="editError" color="error" variant="subtle" :title="editError" />
          <UFormField :label="t('projects.name')" required>
            <UInput
              v-model="editName"
              :placeholder="t('projects.namePlaceholder')"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('projects.description')">
            <RichTextEditor
              v-model="editDescription"
              :placeholder="t('projects.descriptionPlaceholder')"
              :rows="3"
              variant="full"
            />
          </UFormField>
          <UFormField :label="t('projects.color')">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in PROJECT_COLORS"
                :key="color"
                type="button"
                class="h-8 w-8 rounded-lg ring-offset-2 transition"
                :class="editColor === color ? 'ring-2 ring-ocean-700' : 'hover:opacity-80'"
                :style="{ backgroundColor: color }"
                :aria-label="color"
                @click="editColor = color"
              />
            </div>
          </UFormField>
          <UFormField
            v-if="canManageMembers || project?.owner_id === user?.id"
            :label="t('projects.owner')"
          >
            <USelect
              v-model="editOwnerId"
              :items="ownerItems"
              :placeholder="t('projects.selectOwner')"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="showEdit = false">
            {{ t("common.cancel") }}
          </UButton>
          <UButton
            :loading="savingEdit"
            :disabled="!editName.trim()"
            @click="handleSaveProject"
          >
            {{ t("common.save") }}
          </UButton>
        </div>
      </template>
    </UModal>

    <TasksTaskModal
      :task="selectedTask"
      :project-id="projectId"
      :open="showModal"
      @update:open="showModal = $event"
      @saved="onTaskSaved"
    />
  </div>
</template>
