<script setup lang="ts">
import type { Task, TaskStatus, TaskPriority } from "~/types";
import { TASK_STATUSES, TASK_PRIORITIES } from "~/types";
import { format, parseISO } from "date-fns";

definePageMeta({ middleware: "auth" });

const route = useRoute();
const projectId = computed(() => route.params.id as string);

const { getProject, fetchProjects } = useProjects();
const { tasks, loading, searchQuery, fetchTasks } = useTasks(projectId);
const { fetchWorkspace } = useWorkspace();
const { members } = useWorkspace();

const project = computed(() => getProject(projectId.value));
const statusFilter = ref<TaskStatus | "all">("all");
const priorityFilter = ref<TaskPriority | "all">("all");
const assigneeFilter = ref<string | "all">("all");

const showModal = ref(false);
const selectedTask = ref<Task | null>(null);

onMounted(async () => {
  await fetchWorkspace();
  await fetchProjects();
  await fetchTasks(projectId.value);
});

const filteredTasks = computed(() => {
  return tasks.value.filter((t) => {
    if (statusFilter.value !== "all" && t.status !== statusFilter.value) return false;
    if (priorityFilter.value !== "all" && t.priority !== priorityFilter.value) return false;
    if (assigneeFilter.value !== "all" && t.assignee_id !== assigneeFilter.value) return false;
    return true;
  });
});

watch(searchQuery, () => fetchTasks(projectId.value));

function openTask(task: Task) {
  selectedTask.value = task;
  showModal.value = true;
}

function openNew() {
  selectedTask.value = null;
  showModal.value = true;
}
</script>

<template>
  <div class="p-6">
    <div v-if="project" class="mb-4 flex items-center justify-between">
      <h1 class="text-xl font-bold text-slate-900">{{ project.name }} — List</h1>
      <UButton icon="i-lucide-plus" size="sm" @click="openNew">Add Task</UButton>
    </div>

    <LayoutProjectNav class="mb-6" />

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        placeholder="Search tasks..."
        class="w-64"
      />
      <USelect
        v-model="statusFilter"
        :items="[{ label: 'All Status', value: 'all' }, ...TASK_STATUSES.map((s) => ({ label: s.label, value: s.value }))]"
        class="w-40"
      />
      <USelect
        v-model="priorityFilter"
        :items="[{ label: 'All Priority', value: 'all' }, ...TASK_PRIORITIES.map((p) => ({ label: p.label, value: p.value }))]"
        class="w-40"
      />
      <USelect
        v-model="assigneeFilter"
        :items="[
          { label: 'All Assignees', value: 'all' },
          ...members.map((m) => ({ label: m.profiles?.full_name || m.profiles?.email || '', value: m.user_id })),
        ]"
        class="w-48"
      />
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-slate-400" />
    </div>

    <div v-else class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table class="w-full text-sm">
        <thead class="border-b border-slate-200 bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-slate-600">Title</th>
            <th class="px-4 py-3 text-left font-medium text-slate-600">Status</th>
            <th class="px-4 py-3 text-left font-medium text-slate-600">Priority</th>
            <th class="px-4 py-3 text-left font-medium text-slate-600">Assignee</th>
            <th class="px-4 py-3 text-left font-medium text-slate-600">Due Date</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="task in filteredTasks"
            :key="task.id"
            class="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
            @click="openTask(task)"
          >
            <td class="px-4 py-3 font-medium text-slate-800">{{ task.title }}</td>
            <td class="px-4 py-3 capitalize text-slate-600">{{ task.status.replace("_", " ") }}</td>
            <td class="px-4 py-3 capitalize text-slate-600">{{ task.priority }}</td>
            <td class="px-4 py-3 text-slate-600">
              {{ task.profiles?.full_name || task.profiles?.email || "—" }}
            </td>
            <td class="px-4 py-3 text-slate-600">
              {{ task.due_date ? format(parseISO(task.due_date), "d MMM yyyy") : "—" }}
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="filteredTasks.length === 0" class="p-8 text-center text-slate-400">No tasks found</p>
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
