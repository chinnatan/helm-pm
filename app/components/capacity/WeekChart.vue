<script setup lang="ts">
defineProps<{
  title: string;
  plannedLabel: string;
  burnLabel: string;
  buckets: Array<{
    weekStart: string;
    label: string;
    plannedHours: number;
    actualBurnHours: number;
  }>;
  mode?: "forward" | "burn";
}>();

function maxVal(
  buckets: Array<{ plannedHours: number; actualBurnHours: number }>,
  mode: "forward" | "burn" | undefined,
) {
  let m = 1;
  for (const b of buckets) {
    if (mode === "burn") {
      m = Math.max(m, b.plannedHours, b.actualBurnHours);
    } else {
      m = Math.max(m, b.plannedHours);
    }
  }
  return m;
}
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    <h2 class="mb-1 text-sm font-semibold text-slate-700">{{ title }}</h2>
    <slot name="hint" />
    <div class="mt-4 flex items-end gap-2 sm:gap-3" style="min-height: 8rem">
      <div
        v-for="bucket in buckets"
        :key="bucket.weekStart"
        class="flex flex-1 flex-col items-center gap-1"
      >
        <div class="flex h-28 w-full items-end justify-center gap-0.5">
          <template v-if="mode === 'burn'">
            <div
              class="w-1/2 max-w-4 rounded-t bg-slate-300"
              :style="{
                height: `${(bucket.plannedHours / maxVal(buckets, mode)) * 100}%`,
                minHeight: bucket.plannedHours > 0 ? '2px' : '0',
              }"
              :title="`${plannedLabel}: ${bucket.plannedHours}`"
            />
            <div
              class="w-1/2 max-w-4 rounded-t bg-ocean-600"
              :style="{
                height: `${(bucket.actualBurnHours / maxVal(buckets, mode)) * 100}%`,
                minHeight: bucket.actualBurnHours > 0 ? '2px' : '0',
              }"
              :title="`${burnLabel}: ${bucket.actualBurnHours}`"
            />
          </template>
          <div
            v-else
            class="w-full max-w-8 rounded-t bg-ocean-600"
            :style="{
              height: `${(bucket.plannedHours / maxVal(buckets, mode)) * 100}%`,
              minHeight: bucket.plannedHours > 0 ? '2px' : '0',
            }"
            :title="`${plannedLabel}: ${bucket.plannedHours}`"
          />
        </div>
        <span class="text-[10px] text-slate-500 sm:text-xs">{{ bucket.label }}</span>
        <span class="text-[10px] font-medium text-slate-700">
          {{ mode === "burn" ? bucket.actualBurnHours : bucket.plannedHours }}
        </span>
      </div>
    </div>
    <div
      v-if="mode === 'burn'"
      class="mt-3 flex flex-wrap gap-4 text-xs text-slate-500"
    >
      <span class="inline-flex items-center gap-1.5">
        <span class="inline-block h-2.5 w-2.5 rounded-sm bg-slate-300" />
        {{ plannedLabel }}
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="inline-block h-2.5 w-2.5 rounded-sm bg-ocean-600" />
        {{ burnLabel }}
      </span>
    </div>
  </div>
</template>
