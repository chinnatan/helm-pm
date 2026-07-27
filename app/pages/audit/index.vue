<script setup lang="ts">
import type { AuditEntityType } from "~/types";
import { format, parseISO } from "date-fns";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const { fetchWorkspace, isWorkspaceAdmin, workspace } = useWorkspace();
const { entries, loading, fetchAuditLog } = useAuditLog();

const entityFilter = ref<AuditEntityType | "all">("all");
const fromDate = ref("");
const toDate = ref("");

onMounted(async () => {
  await fetchWorkspace();
  if (isWorkspaceAdmin.value) await reload();
});

watch(
  () => workspace.value?.id,
  async (id, prev) => {
    if (id && prev && id !== prev && isWorkspaceAdmin.value) {
      await reload();
    }
  },
);

async function reload() {
  const from = fromDate.value ? new Date(fromDate.value).toISOString() : null;
  let to: string | null = null;
  if (toDate.value) {
    const d = new Date(toDate.value);
    d.setHours(23, 59, 59, 999);
    to = d.toISOString();
  }
  await fetchAuditLog({
    entityType: entityFilter.value,
    from,
    to,
  });
}

const entityOptions = computed(() => [
  { label: t("audit.filterAll"), value: "all" },
  { label: t("audit.entities.project"), value: "project" },
  { label: t("audit.entities.customer"), value: "customer" },
  { label: t("audit.entities.member"), value: "member" },
  { label: t("audit.entities.invite"), value: "invite" },
  { label: t("audit.entities.capacity"), value: "capacity" },
]);

function actionLabel(action: string) {
  const key = `audit.actions.${action}`;
  const translated = t(key);
  return translated === key ? action : translated;
}

function entityLabel(type: string) {
  const key = `audit.entities.${type}`;
  const translated = t(key);
  return translated === key ? type : translated;
}

function formatWhen(iso: string) {
  try {
    return format(parseISO(iso), "dd MMM yyyy HH:mm");
  } catch {
    return iso;
  }
}
</script>

<template>
  <div class="p-4 md:p-6">
    <div class="mb-6">
      <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">{{ t("audit.title") }}</h1>
      <p class="text-sm text-slate-500">
        {{ t("audit.subtitle") }}
        <span v-if="workspace" class="text-slate-400"> · {{ workspace.name }}</span>
      </p>
    </div>

    <div
      v-if="!isWorkspaceAdmin"
      class="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500"
    >
      {{ t("audit.forbidden") }}
    </div>

    <template v-else>
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <UFormField :label="t('audit.filterEntity')" class="w-full sm:w-44">
          <USelect
            v-model="entityFilter"
            :items="entityOptions"
            class="w-full"
            @update:model-value="reload"
          />
        </UFormField>
        <UFormField :label="t('audit.filterFrom')" class="w-full sm:w-44">
          <UInput v-model="fromDate" type="date" class="w-full" @change="reload" />
        </UFormField>
        <UFormField :label="t('audit.filterTo')" class="w-full sm:w-44">
          <UInput v-model="toDate" type="date" class="w-full" @change="reload" />
        </UFormField>
        <UButton variant="soft" @click="reload">{{ t("audit.refresh") }}</UButton>
      </div>

      <div v-if="loading" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-slate-400" />
      </div>

      <div
        v-else-if="entries.length === 0"
        class="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500"
      >
        {{ t("audit.empty") }}
      </div>

      <div v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3 font-medium">{{ t("audit.time") }}</th>
              <th class="px-4 py-3 font-medium">{{ t("audit.actor") }}</th>
              <th class="px-4 py-3 font-medium">{{ t("audit.action") }}</th>
              <th class="px-4 py-3 font-medium">{{ t("audit.entity") }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="row in entries" :key="row.id" class="text-slate-700">
              <td class="whitespace-nowrap px-4 py-3 text-slate-500">
                {{ formatWhen(row.created_at) }}
              </td>
              <td class="px-4 py-3">
                {{
                  row.profiles?.full_name ||
                    row.profiles?.email ||
                    t("audit.system")
                }}
              </td>
              <td class="px-4 py-3">{{ actionLabel(row.action) }}</td>
              <td class="px-4 py-3">
                <span class="text-slate-500">{{ entityLabel(row.entity_type) }}</span>
                <span v-if="row.entity_label" class="ml-1 font-medium text-slate-800">
                  {{ row.entity_label }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
