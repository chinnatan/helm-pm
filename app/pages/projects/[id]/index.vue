<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const route = useRoute();
const projectId = computed(() => route.params.id as string);

const { getProject, fetchProjects } = useProjects();
const { tasks, fetchTasks } = useTasks(projectId);
const { fetchWorkspace } = useWorkspace();

const project = computed(() => getProject(projectId.value));

onMounted(async () => {
  await fetchWorkspace();
  await fetchProjects();
  await fetchTasks(projectId.value);
});

const stats = computed(() => ({
  total: tasks.value.length,
  todo: tasks.value.filter((t) => t.status === "todo").length,
  inProgress: tasks.value.filter((t) => t.status === "in_progress").length,
  done: tasks.value.filter((t) => t.status === "done").length,
}));
</script>

<template>
  <div class="p-6">
    <div v-if="project" class="mb-6">
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
          :style="{ backgroundColor: project.color }"
        >
          {{ project.name[0]?.toUpperCase() }}
        </div>
        <div>
          <h1 class="text-2xl font-bold text-slate-900">{{ project.name }}</h1>
          <p v-if="project.description" class="text-sm text-slate-500">{{ project.description }}</p>
        </div>
      </div>
    </div>

    <LayoutProjectNav class="mb-6" />

    <div class="grid gap-4 sm:grid-cols-4">
      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <p class="text-sm text-slate-500">Total</p>
        <p class="text-2xl font-bold text-slate-900">{{ stats.total }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <p class="text-sm text-slate-500">To Do</p>
        <p class="text-2xl font-bold text-slate-600">{{ stats.todo }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <p class="text-sm text-slate-500">In Progress</p>
        <p class="text-2xl font-bold text-blue-600">{{ stats.inProgress }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <p class="text-sm text-slate-500">Done</p>
        <p class="text-2xl font-bold text-green-600">{{ stats.done }}</p>
      </div>
    </div>
  </div>
</template>
