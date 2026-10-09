<script setup lang="ts">
const open = defineModel<boolean>("open", { required: true });
const { t } = useI18n();
const toast = useToast();
const { customers, fetchCustomers } = useCustomers();
const { features, fetchFeatures } = useFeatures();
const { rollouts, createRollout } = useRollouts();
const { createCommitment } = useCommitments();

const customerId = ref("");
const featureId = ref("");
const month = ref("");
const saving = ref(false);

watch(open, async (isOpen) => {
  if (!isOpen) return;
  customerId.value = "";
  featureId.value = "";
  month.value = "";
  await Promise.all([fetchCustomers(), fetchFeatures()]);
});

const customerItems = computed(() =>
  customers.value
    .filter((c) => c.status === "active")
    .map((c) => ({ label: c.company || c.name, value: c.id })),
);
const featureItems = computed(() => features.value.map((f) => ({ label: f.name, value: f.id })));

const exists = computed(() =>
  rollouts.value.some((r) => r.customer_id === customerId.value && r.feature_id === featureId.value),
);

async function submit() {
  saving.value = true;
  const { data, error } = await createRollout(customerId.value, featureId.value);
  if (error || !data) {
    toast.add({ title: error ?? t("rollouts.createFailed"), color: "error" });
  } else {
    if (month.value) await createCommitment(data.id, monthInputToStart(month.value));
    open.value = false;
  }
  saving.value = false;
}
</script>

<template>
  <UModal v-model:open="open" :title="t('rollouts.newRollout')">
    <template #body>
      <div class="space-y-4">
        <UFormField :label="t('rollouts.customer')" required>
          <USelect v-model="customerId" :items="customerItems" class="w-full" />
        </UFormField>
        <UFormField :label="t('rollouts.feature')" required>
          <USelect v-model="featureId" :items="featureItems" class="w-full" />
        </UFormField>
        <UFormField :label="t('rollouts.commitmentMonth')" :hint="t('rollouts.optional')">
          <UInput v-model="month" type="month" class="w-full" />
        </UFormField>
        <p v-if="exists" class="text-sm text-amber-600">{{ t("rollouts.alreadyExists") }}</p>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="open = false">{{ t("common.cancel") }}</UButton>
        <UButton :loading="saving" :disabled="!customerId || !featureId || exists" @click="submit">
          {{ t("common.create") }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
