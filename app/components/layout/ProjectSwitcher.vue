<script setup lang="ts">
const emit = defineEmits<{
  navigated: [];
}>();

const { t } = useI18n();
const route = useRoute();
const { fetchWorkspace } = useWorkspace();
const { projects, fetchProjects } = useProjects();
const { routeProjectId, activeProjectId, activeProject, rememberProject, projectWorkPath } =
  useLastProject();

const open = ref(false);

async function selectProject(projectId: string) {
  open.value = false;
  rememberProject(projectId);

  const onThisProject =
    routeProjectId.value === projectId &&
    route.path.startsWith(`/projects/${projectId}`);

  if (onThisProject) {
    emit("navigated");
    return;
  }

  await navigateTo(projectWorkPath(projectId));
  emit("navigated");
}

function goAllProjects() {
  open.value = false;
  navigateTo("/projects");
  emit("navigated");
}

onMounted(async () => {
  await fetchWorkspace();
  await fetchProjects();
});
</script>

<template>
  <div class="space-y-1.5">
    <p class="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      {{ t("nav.switchProject") }}
    </p>

    <UPopover v-model:open="open" :content="{ side: 'bottom', align: 'start', sideOffset: 4 }">
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-sm transition-colors hover:border-ocean-300 hover:bg-ocean-50"
        :aria-label="t('nav.switchProject')"
      >
        <span
          v-if="activeProject"
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
          :style="{ backgroundColor: activeProject.color }"
        >
          {{ activeProject.name[0]?.toUpperCase() }}
        </span>
        <span
          v-else
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-200 text-slate-500"
        >
          <UIcon name="i-lucide-folder-kanban" class="h-3.5 w-3.5" />
        </span>
        <span class="min-w-0 flex-1 truncate font-medium text-slate-800">
          {{ activeProject?.name ?? t("nav.selectProject") }}
        </span>
        <UIcon name="i-lucide-chevrons-up-down" class="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      <template #content>
        <div class="w-[min(15.5rem,calc(100vw-3rem))] p-1.5">
          <div v-if="projects.length === 0" class="px-2 py-3 text-center text-xs text-slate-400">
            {{ t("projects.empty") }}
          </div>

          <button
            v-for="project in projects"
            :key="project.id"
            type="button"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-ocean-50"
            :class="
              project.id === activeProjectId
                ? 'bg-ocean-100 text-ocean-900'
                : 'text-slate-700'
            "
            @click="selectProject(project.id)"
          >
            <span
              class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
              :style="{ backgroundColor: project.color }"
            >
              {{ project.name[0]?.toUpperCase() }}
            </span>
            <span class="min-w-0 flex-1 truncate">{{ project.name }}</span>
            <UIcon
              v-if="project.id === activeProjectId"
              name="i-lucide-check"
              class="h-3.5 w-3.5 shrink-0 text-ocean-700"
            />
          </button>

          <div class="my-1 border-t border-slate-100" />

          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50"
            @click="goAllProjects"
          >
            <UIcon name="i-lucide-layout-grid" class="h-4 w-4 shrink-0" />
            {{ t("nav.allProjects") }}
          </button>
        </div>
      </template>
    </UPopover>
  </div>
</template>
