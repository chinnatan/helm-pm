<script setup lang="ts">
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ saved: [] }>();
const { t } = useI18n();
const toast = useToast();
const supabase = useSupabaseClient();
const user = useSupabaseUser();
const { workspace } = useWorkspace();
const { customers, fetchCustomers } = useCustomers();
const { features, fetchFeatures } = useFeatures();

const text = ref("");
const saving = ref(false);

watch(open, (isOpen) => {
  if (!isOpen) return;
  text.value = "";
  if (workspace.value) void Promise.all([fetchCustomers(), fetchFeatures()]);
});

const parsed = computed(() => parseQuickCapture(text.value, customers.value, features.value));

async function submit() {
  if (!parsed.value.title || !workspace.value || saving.value) return;
  saving.value = true;
  // ไม่ใช้ useTasks().createTask: จะไปแก้ state "tasks" ของหน้าที่เปิดอยู่ (ซึ่งอาจมี filter)
  const { error } = await supabase.from("tasks").insert({
    workspace_id: workspace.value.id,
    title: parsed.value.title,
    customer_id: parsed.value.customerId,
    feature_id: parsed.value.featureId,
    status: "inbox",
    created_by: user.value?.id,
  });
  saving.value = false;
  if (error) {
    toast.add({ title: error.message, color: "error" });
    return;
  }
  toast.add({ title: t("quickCapture.saved"), color: "success" });
  emit("saved");
  open.value = false;
}
</script>

<template>
  <UModal v-model:open="open" :title="t('quickCapture.title')">
    <template #body>
      <div class="space-y-3">
        <UInput
          v-model="text"
          autofocus
          class="w-full"
          data-testid="quick-capture-input"
          :placeholder="t('quickCapture.placeholder')"
          @keydown.enter.prevent="submit"
        />
        <div class="flex min-h-6 flex-wrap items-center gap-1.5">
          <UBadge
            v-for="m in parsed.matched"
            :key="m.tag"
            :color="m.kind === 'customer' ? 'primary' : 'success'"
            variant="subtle"
            :icon="m.kind === 'customer' ? 'i-lucide-building-2' : 'i-lucide-puzzle'"
            data-testid="quick-capture-chip"
          >
            {{ m.label }}
          </UBadge>
          <span v-if="!parsed.matched.length" class="text-xs text-slate-400">{{ t("quickCapture.hint") }}</span>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="open = false">{{ t("common.cancel") }}</UButton>
        <UButton :loading="saving" :disabled="!parsed.title" data-testid="quick-capture-save" @click="submit">
          {{ t("common.save") }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
