<script setup lang="ts">
import type { Rollout } from "~/types";
import { rolloutKey } from "~/composables/useRollouts";
import { ROLLOUT_STATUS_STYLE, addMonths } from "~/utils/rollout";

const props = defineProps<{
  rollouts: Rollout[];
  axis: "customer" | "feature";
  startMonth: string;
  monthCount: number;
  openCounts: Record<string, number>;
}>();
const emit = defineEmits<{ select: [rolloutId: string] }>();

const { t } = useI18n();
const { intlLocale } = useDateLocale();

const months = computed(() =>
  Array.from({ length: props.monthCount }, (_, i) => addMonths(props.startMonth, i)),
);

function monthLabel(monthStart: string) {
  return new Date(`${monthStart}T00:00:00`).toLocaleDateString(intlLocale.value, {
    month: "short",
    year: "numeric",
  });
}

function rowOf(r: Rollout) {
  if (props.axis === "customer") {
    return { id: r.customer_id, label: r.customers?.company || r.customers?.name || "—" };
  }
  return { id: r.feature_id, label: r.features?.name ?? "—" };
}

function chipLabel(r: Rollout) {
  return props.axis === "customer"
    ? (r.features?.name ?? "—")
    : (r.customers?.company || r.customers?.name || "—");
}

const rows = computed(() => {
  const byRow = new Map<string, { label: string; rollouts: Rollout[] }>();
  for (const r of props.rollouts) {
    const { id, label } = rowOf(r);
    if (!byRow.has(id)) byRow.set(id, { label, rollouts: [] });
    byRow.get(id)!.rollouts.push(r);
  }
  return [...byRow.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => a.label.localeCompare(b.label));
});

/** column key: "none" = ยังไม่มี Commitment */
function cell(rowRollouts: Rollout[], col: string) {
  return rowRollouts.filter((r) =>
    col === "none"
      ? !r.commitments?.length
      : r.commitments?.some((c) => c.month === col),
  );
}

function openCount(r: Rollout) {
  return props.openCounts[rolloutKey(r.customer_id, r.feature_id)] ?? 0;
}
</script>

<template>
  <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
    <table class="w-full min-w-[56rem] border-collapse text-sm">
      <thead>
        <tr class="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
          <th class="sticky left-0 z-10 w-44 bg-slate-50 px-3 py-2">
            {{ axis === "customer" ? t("rollouts.customer") : t("rollouts.feature") }}
          </th>
          <th class="w-40 px-3 py-2">{{ t("rollouts.noCommitment") }}</th>
          <th v-for="m in months" :key="m" class="w-40 px-3 py-2">{{ monthLabel(m) }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id" class="border-b border-slate-100 align-top last:border-0">
          <th class="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold text-slate-800">
            {{ row.label }}
          </th>
          <td v-for="col in ['none', ...months]" :key="col" class="px-2 py-2">
            <div class="flex flex-col gap-1">
              <button
                v-for="r in cell(row.rollouts, col)"
                :key="r.id"
                type="button"
                class="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-left text-xs font-medium transition-shadow hover:shadow"
                :class="ROLLOUT_STATUS_STYLE[r.status]"
                :title="t(`rollouts.status.${r.status}`)"
                @click="emit('select', r.id)"
              >
                <span class="truncate">{{ chipLabel(r) }}</span>
                <span v-if="openCount(r)" class="shrink-0 rounded bg-white/70 px-1 text-[10px]">
                  {{ openCount(r) }}
                </span>
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
