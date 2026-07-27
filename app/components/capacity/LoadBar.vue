<script setup lang="ts">
import { loadTone } from "~/composables/useTeamCapacity";

const props = withDefaults(
  defineProps<{
    pct: number;
    label?: string;
    showPct?: boolean;
  }>(),
  { showPct: true },
);

const barClass = computed(() => {
  const tone = loadTone(props.pct);
  if (tone === "over") return "bg-red-500";
  if (tone === "warn") return "bg-amber-500";
  return "bg-emerald-500";
});

const width = computed(() => `${Math.min(props.pct, 100)}%`);
</script>

<template>
  <div>
    <div v-if="label || showPct" class="mb-1 flex items-center justify-between gap-2 text-xs">
      <span v-if="label" class="text-slate-500">{{ label }}</span>
      <span
        v-if="showPct"
        class="font-medium"
        :class="{
          'text-red-600': loadTone(pct) === 'over',
          'text-amber-600': loadTone(pct) === 'warn',
          'text-slate-600': loadTone(pct) === 'ok',
        }"
      >
        {{ pct }}%
      </span>
    </div>
    <div class="h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        class="h-full rounded-full transition-all"
        :class="barClass"
        :style="{ width }"
      />
    </div>
  </div>
</template>
