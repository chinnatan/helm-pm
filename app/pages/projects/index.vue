<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const { projects, loading, fetchProjects, createProject } = useProjects();
const { fetchWorkspace } = useWorkspace();
const showCreate = ref(false);
const newName = ref("");
const newDescription = ref("");
const creating = ref(false);

onMounted(async () => {
  await fetchWorkspace();
  await fetchProjects();
});

async function handleCreate() {
  if (!newName.value.trim()) return;
  creating.value = true;
  await createProject(newName.value.trim(), newDescription.value.trim(), null);
  creating.value = false;
  showCreate.value = false;
  newName.value = "";
  newDescription.value = "";
}
</script>

<template>
  <div class="p-4 md:p-6">
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">{{ t("projects.title") }}</h1>
        <p class="text-sm text-slate-500">{{ t("projects.subtitle") }}</p>
      </div>
      <UButton icon="i-lucide-plus" class="shrink-0 self-start sm:self-auto" @click="showCreate = true">
        {{ t("projects.newProject") }}
      </UButton>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-slate-400" />
    </div>

    <div v-else-if="projects.length === 0" class="rounded-xl border border-dashed border-slate-300 p-8 text-center sm:p-12">
      <UIcon name="i-lucide-folder-kanban" class="mx-auto mb-3 h-10 w-10 text-slate-300" />
      <p class="mb-4 text-slate-500">{{ t("projects.empty") }}</p>
      <UButton @click="showCreate = true">{{ t("projects.createFirst") }}</UButton>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="project in projects"
        :key="project.id"
        class="group relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
      >
        <NuxtLink :to="`/projects/${project.id}`" class="absolute inset-0 z-0 rounded-xl" />
        <div class="relative z-10 mb-3 flex items-start gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
            :style="{ backgroundColor: project.color }"
          >
            {{ project.name[0]?.toUpperCase() }}
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="font-semibold text-slate-900 group-hover:text-slate-700">{{ project.name }}</h3>
            <p v-if="project.description" class="text-xs text-slate-500 line-clamp-1">
              {{ stripMarkdownForPreview(project.description) }}
            </p>
            <p v-if="project.owner" class="mt-1 text-xs text-slate-400">
              {{ project.owner.full_name || project.owner.email }}
            </p>
          </div>
          <UButton
            :to="`/projects/${project.id}?edit=1`"
            icon="i-lucide-pencil"
            size="xs"
            variant="ghost"
            color="neutral"
            class="relative z-10 shrink-0"
            :aria-label="t('projects.editProject')"
          />
        </div>
      </div>
    </div>

    <UModal v-model:open="showCreate" :title="t('projects.newProject')">
      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('projects.name')" required>
            <UInput v-model="newName" :placeholder="t('projects.namePlaceholder')" class="w-full" />
          </UFormField>
          <UFormField :label="t('projects.description')">
            <RichTextEditor
              v-model="newDescription"
              :placeholder="t('projects.descriptionPlaceholder')"
              :rows="2"
              variant="full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="showCreate = false">{{ t("common.cancel") }}</UButton>
          <UButton :loading="creating" :disabled="!newName.trim()" @click="handleCreate">{{ t("common.create") }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
