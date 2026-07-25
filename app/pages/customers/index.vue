<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const { fetchWorkspace } = useWorkspace();
const { customers, openTaskCounts, loading, fetchCustomers, createCustomer } = useCustomers();

const showCreate = ref(false);
const creating = ref(false);
const form = reactive({
  name: "",
  company: "",
  contact_email: "",
  notes: "",
});

const activeCustomers = computed(() =>
  customers.value.filter((c) => c.status === "active"),
);

onMounted(async () => {
  await fetchWorkspace();
  await fetchCustomers();
});

async function handleCreate() {
  if (!form.name.trim()) return;
  creating.value = true;
  await createCustomer({
    name: form.name.trim(),
    company: form.company.trim() || null,
    contact_email: form.contact_email.trim() || null,
    notes: form.notes.trim() || null,
  });
  creating.value = false;
  showCreate.value = false;
  form.name = "";
  form.company = "";
  form.contact_email = "";
  form.notes = "";
}
</script>

<template>
  <div class="p-4 md:p-6">
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">{{ t("customers.title") }}</h1>
        <p class="text-sm text-slate-500">{{ t("customers.subtitle") }}</p>
      </div>
      <UButton icon="i-lucide-plus" class="shrink-0 self-start sm:self-auto" @click="showCreate = true">
        {{ t("customers.newCustomer") }}
      </UButton>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-slate-400" />
    </div>

    <div
      v-else-if="activeCustomers.length === 0"
      class="rounded-xl border border-dashed border-slate-300 p-8 text-center sm:p-12"
    >
      <UIcon name="i-lucide-building-2" class="mx-auto mb-3 h-10 w-10 text-slate-300" />
      <p class="mb-4 text-slate-500">{{ t("customers.empty") }}</p>
      <UButton @click="showCreate = true">{{ t("customers.createFirst") }}</UButton>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="customer in activeCustomers"
        :key="customer.id"
        :to="`/customers/${customer.id}`"
        class="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
      >
        <div class="mb-3 flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="font-semibold text-slate-900 group-hover:text-ocean-800">
              {{ customer.name }}
            </h3>
            <p v-if="customer.company" class="text-xs text-slate-500">{{ customer.company }}</p>
          </div>
          <UBadge color="primary" variant="subtle" size="sm">
            {{ openTaskCounts[customer.id] ?? 0 }} {{ t("customers.openTasksShort") }}
          </UBadge>
        </div>
        <p v-if="customer.contact_email" class="truncate text-sm text-slate-600">
          {{ customer.contact_email }}
        </p>
      </NuxtLink>
    </div>

    <UModal v-model:open="showCreate" :title="t('customers.newCustomer')">
      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('customers.name')" required>
            <UInput v-model="form.name" :placeholder="t('customers.namePlaceholder')" class="w-full" />
          </UFormField>
          <UFormField :label="t('customers.company')">
            <UInput v-model="form.company" :placeholder="t('customers.companyPlaceholder')" class="w-full" />
          </UFormField>
          <UFormField :label="t('customers.contactEmail')">
            <UInput v-model="form.contact_email" type="email" class="w-full" />
          </UFormField>
          <UFormField :label="t('customers.notes')">
            <UTextarea v-model="form.notes" :rows="2" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="showCreate = false">
            {{ t("common.cancel") }}
          </UButton>
          <UButton :loading="creating" :disabled="!form.name.trim()" @click="handleCreate">
            {{ t("common.create") }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
