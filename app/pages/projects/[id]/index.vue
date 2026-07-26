<script setup lang="ts">
import type { Task } from "~/types";
import { isTaskClosed } from "~/types";
import { format, parseISO, isBefore, startOfDay } from "date-fns";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const { dateFnsLocale } = useDateLocale();
const route = useRoute();
const projectId = computed(() => route.params.id as string);

const { getProject, fetchProjects, updateProject } = useProjects();
const { tasks, fetchTasks } = useTasks(projectId);
const { fetchWorkspace } = useWorkspace();
const { customers, fetchCustomers } = useCustomers();

const project = computed(() => getProject(projectId.value));
const showModal = ref(false);
const selectedTask = ref<Task | null>(null);
const savingCustomer = ref(false);

const customerItems = computed(() => [
  { label: t("common.none"), value: null },
  ...customers.value
    .filter((c) => c.status === "active")
    .map((c) => ({ label: c.name, value: c.id })),
]);

onMounted(async () => {
  await fetchWorkspace();
  await Promise.all([fetchProjects(), fetchCustomers()]);
  await fetchTasks(projectId.value);
});

async function handleCustomerChange(value: string | null) {
  if (!project.value) return;
  savingCustomer.value = true;
  await updateProject(project.value.id, { customer_id: value });
  savingCustomer.value = false;
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

function formatDue(date: string) {
  return format(parseISO(date), "d MMM", { locale: dateFnsLocale.value });
}
</script>

<template>
  <div class="p-4 md:p-6">
    <LayoutProjectHeader v-if="project" :project="project">
      <template #actions>
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

    <div v-if="project" class="mb-4 max-w-xs">
      <UFormField :label="t('projects.customer')">
        <USelect
          :model-value="project.customer_id"
          :items="customerItems"
          :placeholder="t('projects.selectCustomer')"
          :disabled="savingCustomer"
          class="w-full"
          @update:model-value="(v) => handleCustomerChange(v as string | null)"
        />
      </UFormField>
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

    <TasksTaskModal
      :task="selectedTask"
      :project-id="projectId"
      :open="showModal"
      @update:open="showModal = $event"
      @saved="fetchTasks(projectId)"
    />
  </div>
</template>
