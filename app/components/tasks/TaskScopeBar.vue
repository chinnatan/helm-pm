<script setup lang="ts">
import { TASK_TYPE_VALUES } from "~/types";

const { t } = useI18n();
const route = useRoute();
const { filters, setScope } = useTaskScope();
const { customers, fetchCustomers } = useCustomers();
const { features, fetchFeatures } = useFeatures();

const { workspace } = useWorkspace();
// workspace อาจยังโหลดไม่เสร็จตอน mount — รอ id ก่อนดึง
watch(
  () => workspace.value?.id,
  (id) => {
    if (id) void Promise.all([fetchCustomers(), fetchFeatures()]);
  },
  { immediate: true },
);

const ALL = "all";
const customerItems = computed(() => [
  { label: t("tasks.scopeAllCustomers"), value: ALL },
  ...customers.value.filter((c) => c.status === "active").map((c) => ({ label: formatCustomerLabel(c), value: c.id })),
]);
const featureItems = computed(() => [
  { label: t("tasks.scopeAllFeatures"), value: ALL },
  ...features.value.map((f) => ({ label: f.name, value: f.id })),
]);
const typeItems = computed(() => [
  { label: t("tasks.scopeAllTypes"), value: ALL },
  ...TASK_TYPE_VALUES.map((v) => ({ label: t(`tasks.type.${v}`), value: v })),
]);

const pick = (v: unknown) => (v === ALL ? null : (v as string));

const tabs = computed(() => [
  { label: t("projectNav.board"), to: "/tasks/board", icon: "i-lucide-columns-3" },
  { label: t("projectNav.list"), to: "/tasks/list", icon: "i-lucide-list" },
]);
</script>

<template>
  <div class="mb-4 space-y-3">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">{{ t("tasks.pageTitle") }}</h1>
      <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2 self-start sm:self-auto">
        <slot name="actions" />
      </div>
    </div>

    <div class="flex min-w-max gap-1 border-b border-slate-200">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="{ path: tab.to, query: route.query }"
        class="flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium transition-colors"
        :class="route.path === tab.to ? 'border-b-2 border-ocean-700 text-ocean-900' : 'text-slate-500 hover:text-ocean-800'"
      >
        <UIcon :name="tab.icon" class="h-4 w-4" />
        {{ tab.label }}
      </NuxtLink>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <USelect :model-value="filters.customerId ?? ALL" :items="customerItems" size="sm" class="w-48" data-testid="scope-customer" @update:model-value="(v) => setScope({ customer: pick(v) })" />
      <USelect :model-value="filters.featureId ?? ALL" :items="featureItems" size="sm" class="w-48" data-testid="scope-feature" @update:model-value="(v) => setScope({ feature: pick(v) })" />
      <UButton
        size="sm"
        :variant="filters.unlinked ? 'solid' : 'outline'"
        color="neutral"
        icon="i-lucide-unlink"
        data-testid="scope-unlinked"
        @click="setScope({ unlinked: filters.unlinked ? null : '1' })"
      >
        {{ t("tasks.scopeUnlinked") }}
      </UButton>
      <UButton
        size="sm"
        :variant="filters.unanswered ? 'solid' : 'outline'"
        color="neutral"
        icon="i-lucide-message-circle-question"
        data-testid="scope-unanswered"
        @click="setScope({ unanswered: filters.unanswered ? null : '1' })"
      >
        {{ t("tasks.scopeUnanswered") }}
      </UButton>
      <USelect :model-value="filters.taskType ?? ALL" :items="typeItems" size="sm" class="w-44" data-testid="scope-type" @update:model-value="(v) => setScope({ type: pick(v) })" />
    </div>
  </div>
</template>
