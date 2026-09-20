<script setup lang="ts">
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();
const { t } = useI18n();
const { templates, fetchTemplates, updateTemplate, deleteTemplate } = useTaskTemplates();
const { confirm } = useConfirmDialog();

watch(
  () => props.open,
  (open) => {
    if (open) void fetchTemplates();
  },
);

async function rename(id: string, value: string) {
  const title = value.trim();
  if (title) await updateTemplate(id, { title });
}

async function remove(id: string) {
  const ok = await confirm({
    title: t("templates.delete"),
    description: t("templates.deleteConfirm"),
    confirmLabel: t("common.delete"),
    color: "error",
  });
  if (ok) await deleteTemplate(id);
}
</script>

<template>
  <UModal :open="open" :title="t('templates.manageTitle')" @update:open="emit('update:open', $event)">
    <template #body>
      <div class="space-y-2">
        <p v-if="templates.length === 0" class="py-4 text-center text-sm text-slate-400">
          {{ t("templates.empty") }}
        </p>
        <template v-for="template in templates" :key="template.id">
          <div class="flex items-center gap-2 rounded-lg border border-slate-200 p-2" data-testid="template-item">
            <UInput
              :model-value="template.title"
              class="min-w-0 flex-1"
              data-testid="template-title"
              @change="(event) => rename(template.id, (event.target as HTMLInputElement).value)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              data-testid="template-delete"
              :aria-label="t('templates.delete')"
              @click="remove(template.id)"
            />
          </div>
        </template>
      </div>
    </template>
  </UModal>
</template>
