<script setup lang="ts">
import { addMonths } from "~/utils/rollout";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const { fetchWorkspace, canManageMembers: canManage } = useWorkspace();
const { rollouts, openTaskCounts, unlinkedTaskCount, loading, fetchRollouts } = useRollouts();

const MONTH_COUNT = 6;
const axis = ref<"customer" | "feature">("customer");
const startMonth = ref(addMonths(toMonthStart(new Date()), -1));

const selectedId = ref<string | null>(null);
const panelOpen = ref(false);
const createOpen = ref(false);

const axisItems = computed(() => [
  { label: t("rollouts.byCustomer"), value: "customer" },
  { label: t("rollouts.byFeature"), value: "feature" },
]);

function select(id: string) {
  selectedId.value = id;
  panelOpen.value = true;
}

onMounted(async () => {
  await fetchWorkspace();
  await fetchRollouts();
});
</script>

<template>
  <div class="p-4 md:p-6">
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">{{ t("rollouts.title") }}</h1>
        <p class="text-sm text-slate-500">{{ t("rollouts.subtitle") }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <USelect v-model="axis" :items="axisItems" size="sm" class="w-40" />
        <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-chevron-left" :aria-label="t('rollouts.prevMonths')" @click="startMonth = addMonths(startMonth, -MONTH_COUNT)" />
        <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-chevron-right" :aria-label="t('rollouts.nextMonths')" @click="startMonth = addMonths(startMonth, MONTH_COUNT)" />
        <UButton v-if="canManage" size="sm" icon="i-lucide-plus" @click="createOpen = true">
          {{ t("rollouts.newRollout") }}
        </UButton>
      </div>
    </div>

    <div v-if="loading && !rollouts.length" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-slate-400" />
    </div>

    <div v-else-if="!rollouts.length" class="rounded-xl border border-dashed border-slate-300 p-8 text-center sm:p-12">
      <UIcon name="i-lucide-grid-3x3" class="mx-auto mb-3 h-10 w-10 text-slate-300" />
      <p class="mb-4 text-slate-500">{{ t("rollouts.empty") }}</p>
      <UButton v-if="canManage" @click="createOpen = true">{{ t("rollouts.newRollout") }}</UButton>
    </div>

    <RolloutsRolloutMatrix
      v-else
      :rollouts="rollouts"
      :axis="axis"
      :start-month="startMonth"
      :month-count="MONTH_COUNT"
      :open-counts="openTaskCounts"
      @select="select"
    />

    <NuxtLink
      v-if="unlinkedTaskCount"
      :to="{ path: '/tasks/list', query: { unlinked: '1' } }"
      class="mt-3 inline-block text-sm text-amber-700 hover:underline"
    >
      {{ t("rollouts.unlinkedTasks", { n: unlinkedTaskCount }) }}
    </NuxtLink>

    <RolloutsRolloutPanel v-model:open="panelOpen" :rollout-id="selectedId" />
    <RolloutsRolloutCreateModal v-model:open="createOpen" />
  </div>
</template>
