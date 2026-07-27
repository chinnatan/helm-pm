<script setup lang="ts">
const emit = defineEmits<{
  navigated: [];
}>();

const { t } = useI18n();
const {
  workspace,
  workspaces,
  fetchWorkspace,
  setActiveWorkspace,
  createWorkspace,
} = useWorkspace();

const open = ref(false);
const showCreate = ref(false);
const newName = ref("");
const creating = ref(false);
const switching = ref(false);
const errorMsg = ref<string | null>(null);

onMounted(async () => {
  await fetchWorkspace();
});

async function selectWorkspace(id: string) {
  if (id === workspace.value?.id) {
    open.value = false;
    return;
  }

  switching.value = true;
  errorMsg.value = null;
  const { error } = await setActiveWorkspace(id);
  switching.value = false;

  if (error) {
    errorMsg.value = error;
    return;
  }

  open.value = false;
  await navigateTo("/projects");
  emit("navigated");
}

function openCreate() {
  open.value = false;
  newName.value = "";
  errorMsg.value = null;
  showCreate.value = true;
}

async function handleCreate() {
  if (!newName.value.trim() || creating.value) return;
  creating.value = true;
  errorMsg.value = null;

  const { error } = await createWorkspace(newName.value);
  creating.value = false;

  if (error) {
    errorMsg.value = error;
    return;
  }

  showCreate.value = false;
  newName.value = "";
  await navigateTo("/projects");
  emit("navigated");
}
</script>

<template>
  <div class="space-y-1.5">
    <p class="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      {{ t("nav.switchWorkspace") }}
    </p>

    <UPopover v-model:open="open" :content="{ side: 'bottom', align: 'start', sideOffset: 4 }">
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-sm transition-colors hover:border-ocean-300 hover:bg-ocean-50"
        :aria-label="t('nav.switchWorkspace')"
        :disabled="switching"
      >
        <span
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ocean-800 text-[10px] font-bold text-white"
        >
          {{ workspace?.name?.[0]?.toUpperCase() ?? "W" }}
        </span>
        <span class="min-w-0 flex-1 truncate font-medium text-slate-800">
          {{ workspace?.name ?? t("nav.selectWorkspace") }}
        </span>
        <UIcon name="i-lucide-chevrons-up-down" class="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      <template #content>
        <div class="w-[min(15.5rem,calc(100vw-3rem))] p-1.5">
          <div
            v-if="workspaces.length === 0"
            class="px-2 py-3 text-center text-xs text-slate-400"
          >
            {{ t("workspace.empty") }}
          </div>

          <button
            v-for="item in workspaces"
            :key="item.workspace.id"
            type="button"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-ocean-50"
            :class="
              item.workspace.id === workspace?.id
                ? 'bg-ocean-100 text-ocean-900'
                : 'text-slate-700'
            "
            @click="selectWorkspace(item.workspace.id)"
          >
            <span
              class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white bg-ocean-800"
            >
              {{ item.workspace.name[0]?.toUpperCase() }}
            </span>
            <span class="min-w-0 flex-1 truncate">{{ item.workspace.name }}</span>
            <UIcon
              v-if="item.workspace.id === workspace?.id"
              name="i-lucide-check"
              class="h-3.5 w-3.5 shrink-0 text-ocean-700"
            />
          </button>

          <div class="my-1 border-t border-slate-100" />

          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50"
            @click="openCreate"
          >
            <UIcon name="i-lucide-plus" class="h-4 w-4 shrink-0" />
            {{ t("workspace.create") }}
          </button>
        </div>
      </template>
    </UPopover>

    <p v-if="errorMsg && !showCreate" class="px-1 text-xs text-red-500">
      {{ errorMsg }}
    </p>

    <UModal v-model:open="showCreate" :title="t('workspace.createTitle')">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-slate-500">
            {{ t("workspace.createHint") }}
          </p>
          <UFormField :label="t('workspace.name')" required>
            <UInput
              v-model="newName"
              :placeholder="t('workspace.namePlaceholder')"
              class="w-full"
              autofocus
              @keydown.enter.prevent="handleCreate"
            />
          </UFormField>
          <p v-if="errorMsg" class="text-sm text-red-500">{{ errorMsg }}</p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            @click="showCreate = false"
          >
            {{ t("common.cancel") }}
          </UButton>
          <UButton
            :loading="creating"
            :disabled="!newName.trim()"
            @click="handleCreate"
          >
            {{ t("common.create") }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
