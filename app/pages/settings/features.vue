<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const toast = useToast();
const { fetchWorkspace, canManageMembers: canManage } = useWorkspace();
const { confirm } = useConfirmDialog();
const { features, loading, fetchFeatures, createFeature, updateFeature, archiveFeature, reorderFeatures } =
  useFeatures();

const newName = ref("");
const editingId = ref<string | null>(null);
const editName = ref("");

onMounted(async () => {
  await fetchWorkspace();
  await fetchFeatures();
});

function notify(error?: string) {
  if (error) toast.add({ title: error, color: "error" });
}

async function add() {
  const name = newName.value.trim();
  if (!name) return;
  const { error } = await createFeature(name);
  notify(error);
  if (!error) newName.value = "";
}

function startEdit(id: string, name: string) {
  editingId.value = id;
  editName.value = name;
}

async function saveEdit(id: string) {
  const name = editName.value.trim();
  if (name) notify((await updateFeature(id, { name })).error);
  editingId.value = null;
}

async function archive(id: string) {
  const ok = await confirm({
    title: t("features.archiveConfirm"),
    color: "warning",
    confirmLabel: t("features.archive"),
  });
  if (ok) notify((await archiveFeature(id)).error);
}

async function move(index: number, delta: -1 | 1) {
  const ids = features.value.map((f) => f.id);
  const target = index + delta;
  if (target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target]!, ids[index]!];
  notify((await reorderFeatures(ids)).error);
}
</script>

<template>
  <div class="mx-auto max-w-2xl p-4 md:p-6">
    <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">{{ t("features.title") }}</h1>
    <p class="mb-6 text-sm text-slate-500">{{ t("features.subtitle") }}</p>

    <form v-if="canManage" class="mb-4 flex gap-2" @submit.prevent="add">
      <UInput v-model="newName" :placeholder="t('features.namePlaceholder')" class="flex-1" />
      <UButton type="submit" icon="i-lucide-plus" :disabled="!newName.trim()">{{ t("common.add") }}</UButton>
    </form>

    <div v-if="loading" class="flex justify-center py-8">
      <UIcon name="i-lucide-loader-2" class="h-6 w-6 animate-spin text-slate-400" />
    </div>
    <p v-else-if="!features.length" class="text-sm text-slate-400">{{ t("features.empty") }}</p>

    <ul class="space-y-2">
      <li
        v-for="(f, i) in features"
        :key="f.id"
        class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
      >
        <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: f.color }" />
        <UInput
          v-if="editingId === f.id"
          v-model="editName"
          size="sm"
          class="flex-1"
          autofocus
          @keydown.enter="saveEdit(f.id)"
          @keydown.esc="editingId = null"
          @blur="saveEdit(f.id)"
        />
        <span v-else class="flex-1 truncate font-medium text-slate-800">{{ f.name }}</span>
        <div v-if="canManage" class="flex shrink-0 gap-1">
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-arrow-up" :disabled="i === 0" :aria-label="t('features.moveUp')" @click="move(i, -1)" />
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-arrow-down" :disabled="i === features.length - 1" :aria-label="t('features.moveDown')" @click="move(i, 1)" />
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-pencil" :aria-label="t('features.rename')" @click="startEdit(f.id, f.name)" />
          <UButton size="xs" variant="ghost" color="warning" icon="i-lucide-archive" :aria-label="t('features.archive')" @click="archive(f.id)" />
        </div>
      </li>
    </ul>
  </div>
</template>
