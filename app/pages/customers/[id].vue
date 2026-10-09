<script setup lang="ts">
import type { Customer, Task } from "~/types";
import { ROLLOUT_STATUS_STYLE } from "~/utils/rollout";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const toast = useToast();
const route = useRoute();
const customerId = computed(() => route.params.id as string);

const { fetchWorkspace, isWorkspaceAdmin } = useWorkspace();
const {
  getCustomer,
  updateCustomer,
  archiveCustomer,
  restoreCustomer,
  deleteCustomer,
  fetchOpenTasksForCustomer,
  fetchCustomers,
} = useCustomers();
const { features, fetchFeatures } = useFeatures();
const { rollouts, fetchRollouts } = useRollouts();
const { createTask } = useTasks();
const { confirm } = useConfirmDialog();

const customer = ref<Customer | null>(null);
const openTasks = ref<Task[]>([]);
const loading = ref(true);
const saving = ref(false);

const editForm = reactive({
  name: "",
  company: "",
  contact_email: "",
  notes: "",
});

const customerRollouts = computed(() =>
  rollouts.value.filter((r) => r.customer_id === customerId.value),
);

const showQuickTask = ref(false);
const quickTask = reactive({
  title: "",
  feature_id: null as string | null,
  due_date: "",
});
const savingQuickTask = ref(false);

const featureItems = computed(() => [
  { label: t("common.none"), value: null },
  ...features.value.map((f) => ({ label: f.name, value: f.id })),
]);

function openQuickTask() {
  quickTask.title = "";
  quickTask.feature_id = null;
  quickTask.due_date = "";
  showQuickTask.value = true;
}

async function handleQuickCreateTask() {
  if (!quickTask.title.trim()) return;
  savingQuickTask.value = true;
  const { error } = await createTask({
    title: quickTask.title.trim(),
    customer_id: customerId.value,
    feature_id: quickTask.feature_id,
    due_date: quickTask.due_date || null,
  });
  savingQuickTask.value = false;
  if (error) {
    toast.add({ title: error, color: "error" });
    return;
  }
  showQuickTask.value = false;
  openTasks.value = await fetchOpenTasksForCustomer(customerId.value);
}

async function load() {
  loading.value = true;
  await Promise.all([fetchWorkspace(), fetchCustomers()]);
  await Promise.all([fetchFeatures(), fetchRollouts()]);
  customer.value = await getCustomer(customerId.value);
  if (customer.value) {
    editForm.name = customer.value.name;
    editForm.company = customer.value.company ?? "";
    editForm.contact_email = customer.value.contact_email ?? "";
    editForm.notes = customer.value.notes ?? "";
  }
  openTasks.value = await fetchOpenTasksForCustomer(customerId.value);
  loading.value = false;
}

onMounted(load);

async function handleSaveCustomer() {
  if (!customer.value || !editForm.name.trim()) return;
  saving.value = true;
  const { data } = await updateCustomer(customer.value.id, {
    name: editForm.name.trim(),
    company: editForm.company.trim() || null,
    contact_email: editForm.contact_email.trim() || null,
    notes: editForm.notes.trim() || null,
  });
  if (data) customer.value = data;
  saving.value = false;
}

async function handleArchive() {
  if (!customer.value) return;
  const ok = await confirm({
    title: t("customers.archive"),
    description: t("customers.archiveConfirm"),
    confirmLabel: t("customers.archive"),
    color: "warning",
    icon: "i-lucide-archive",
  });
  if (!ok) return;
  await archiveCustomer(customer.value.id);
  navigateTo("/customers");
}

async function handleRestore() {
  if (!customer.value) return;
  const { data } = await restoreCustomer(customer.value.id);
  if (data) customer.value = data;
}

async function handleDelete() {
  if (!customer.value || !isWorkspaceAdmin.value) return;
  const ok = await confirm({
    title: t("customers.delete"),
    description: t("customers.deleteConfirm"),
    confirmLabel: t("common.delete"),
    color: "error",
  });
  if (!ok) return;
  const { error } = await deleteCustomer(customer.value.id);
  if (!error) navigateTo("/customers");
}
</script>

<template>
  <div class="p-4 md:p-6">
    <div class="mb-4">
      <NuxtLink
        to="/customers"
        class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ocean-800"
      >
        <UIcon name="i-lucide-arrow-left" class="h-4 w-4" />
        {{ t("customers.back") }}
      </NuxtLink>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-slate-400" />
    </div>

    <div v-else-if="!customer" class="py-12 text-center text-slate-500">
      {{ t("customers.notFound") }}
    </div>

    <template v-else>
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">{{ customer.name }}</h1>
            <UBadge
              v-if="customer.status === 'archived'"
              color="neutral"
              variant="subtle"
              size="sm"
            >
              {{ t("customers.archived") }}
            </UBadge>
          </div>
          <p v-if="customer.company" class="text-sm text-slate-500">{{ customer.company }}</p>
        </div>
        <div class="flex shrink-0 flex-wrap gap-2">
          <UButton
            v-if="customer.status === 'archived'"
            variant="outline"
            color="neutral"
            size="sm"
            @click="handleRestore"
          >
            {{ t("customers.restore") }}
          </UButton>
          <UButton
            v-else
            variant="ghost"
            color="error"
            size="sm"
            @click="handleArchive"
          >
            {{ t("customers.archive") }}
          </UButton>
          <UButton
            v-if="isWorkspaceAdmin"
            variant="soft"
            color="error"
            size="sm"
            @click="handleDelete"
          >
            {{ t("customers.delete") }}
          </UButton>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <!-- Details -->
        <section class="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-1">
          <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {{ t("customers.details") }}
          </h2>
          <div class="space-y-3">
            <UFormField :label="t('customers.name')">
              <UInput v-model="editForm.name" class="w-full" />
            </UFormField>
            <UFormField :label="t('customers.company')">
              <UInput v-model="editForm.company" class="w-full" />
            </UFormField>
            <UFormField :label="t('customers.contactEmail')">
              <UInput v-model="editForm.contact_email" type="email" class="w-full" />
            </UFormField>
            <UFormField :label="t('customers.notes')">
              <RichTextEditor v-model="editForm.notes" :rows="3" variant="full" />
            </UFormField>
            <UButton :loading="saving" @click="handleSaveCustomer">
              {{ t("common.save") }}
            </UButton>
          </div>
        </section>

        <div class="space-y-6 lg:col-span-2">
          <!-- Rollouts -->
          <section class="rounded-xl border border-slate-200 bg-white p-4">
            <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {{ t("customers.rollouts") }}
              <span class="ml-1 text-ocean-800">({{ customerRollouts.length }})</span>
            </h2>
            <ul v-if="customerRollouts.length" class="space-y-2">
              <li
                v-for="r in customerRollouts"
                :key="r.id"
                class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                :class="ROLLOUT_STATUS_STYLE[r.status]"
              >
                <span class="font-medium">{{ r.features?.name }}</span>
                <span class="text-xs">
                  {{ t(`rollouts.status.${r.status}`) }}
                  <template v-if="r.commitments?.length">
                    · {{ r.commitments.map((c) => c.month.slice(0, 7)).sort().join(", ") }}
                  </template>
                </span>
              </li>
            </ul>
            <p v-else class="text-sm text-slate-400">{{ t("customers.noRollouts") }}</p>
          </section>

          <!-- Open tasks -->
          <section class="rounded-xl border border-slate-200 bg-white p-4">
            <div class="mb-3 flex items-center justify-between gap-2">
              <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {{ t("customers.openTasks") }}
                <span class="ml-1 text-ocean-800">({{ openTasks.length }})</span>
              </h2>
              <div class="flex items-center gap-2">
                <NuxtLink
                  :to="{ path: '/tasks/board', query: { customer: customerId } }"
                  class="text-xs font-medium text-ocean-800 hover:underline"
                >
                  {{ t("customers.viewProject") }}
                </NuxtLink>
                <UButton size="xs" icon="i-lucide-plus" @click="openQuickTask">
                  {{ t("customers.quickCreate") }}
                </UButton>
              </div>
            </div>
            <ul v-if="openTasks.length" class="divide-y divide-slate-100">
              <li
                v-for="task in openTasks"
                :key="task.id"
                class="flex items-center justify-between gap-3 py-2.5"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-slate-800">{{ task.title }}</p>
                  <p class="text-xs text-slate-500">
                    {{ task.features?.name }}<template v-if="task.features"> · </template>{{ t(`status.${task.status}`) }}
                  </p>
                </div>
                <NuxtLink
                  :to="{ path: '/tasks/board', query: { task: task.id } }"
                  class="shrink-0 text-xs font-medium text-ocean-800 hover:underline"
                >
                  {{ t("customers.openTask") }}
                </NuxtLink>
              </li>
            </ul>
            <p v-else class="text-sm text-slate-400">{{ t("customers.noOpenTasks") }}</p>
          </section>
        </div>
      </div>
    </template>

    <UModal v-model:open="showQuickTask" :title="t('customers.quickCreate')">
      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('tasks.title')" required>
            <UInput v-model="quickTask.title" class="w-full" />
          </UFormField>
          <UFormField :label="t('rollouts.feature')">
            <USelect v-model="quickTask.feature_id" :items="featureItems" class="w-full" />
          </UFormField>
          <UFormField :label="t('tasks.dueDate')">
            <UInput v-model="quickTask.due_date" type="date" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="showQuickTask = false">{{ t("common.cancel") }}</UButton>
          <UButton :loading="savingQuickTask" :disabled="!quickTask.title.trim()" @click="handleQuickCreateTask">
            {{ t("common.create") }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
