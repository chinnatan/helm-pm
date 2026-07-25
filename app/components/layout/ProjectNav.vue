<script setup lang="ts">
const route = useRoute();
const { t } = useI18n();
const projectId = computed(() => route.params.id as string);

const tabs = computed(() => [
  { label: t("projectNav.overview"), to: `/projects/${projectId.value}`, icon: "i-lucide-layout-dashboard" },
  { label: t("projectNav.board"), to: `/projects/${projectId.value}/board`, icon: "i-lucide-columns-3" },
  { label: t("projectNav.list"), to: `/projects/${projectId.value}/list`, icon: "i-lucide-list" },
  { label: t("projectNav.gantt"), to: `/projects/${projectId.value}/gantt`, icon: "i-lucide-gantt-chart" },
  { label: t("projectNav.calendar"), to: `/projects/${projectId.value}/calendar`, icon: "i-lucide-calendar" },
]);

function isActive(path: string) {
  return route.path === path;
}
</script>

<template>
  <div class="flex gap-1 border-b border-slate-200 px-1">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium transition-colors"
      :class="
        isActive(tab.to)
          ? 'border-b-2 border-slate-800 text-slate-900'
          : 'text-slate-500 hover:text-slate-700'
      "
    >
      <UIcon :name="tab.icon" class="h-4 w-4" />
      {{ tab.label }}
    </NuxtLink>
  </div>
</template>
