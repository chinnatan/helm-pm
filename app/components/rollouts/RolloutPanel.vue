<script setup lang="ts">
import type { Commitment, CommitmentTargetStatus, RolloutStatus, Task } from "~/types";
import { COMMITMENT_TARGET_STATUS_VALUES, ROLLOUT_STATUS_VALUES, TASK_CLOSED_STATUSES } from "~/types";
import { ROLLOUT_STATUS_STYLE, monthInputToStart } from "~/utils/rollout";

const props = defineProps<{ rolloutId: string | null }>();
const open = defineModel<boolean>("open", { required: true });

const { t } = useI18n();
const toast = useToast();
const supabase = useSupabaseClient();
const { canManageMembers: canManage } = useWorkspace();
const { confirm } = useConfirmDialog();
const { intlLocale } = useDateLocale();
const { rollouts, setRolloutStatus, deleteRollout } = useRollouts();
const { createCommitment, rescheduleCommitment, deleteCommitment } = useCommitments();

const rollout = computed(() => rollouts.value.find((r) => r.id === props.rolloutId) ?? null);
const commitments = computed(() =>
  [...(rollout.value?.commitments ?? [])].sort((a, b) => a.month.localeCompare(b.month)),
);

const statusItems = computed(() =>
  ROLLOUT_STATUS_VALUES.map((v) => ({ label: t(`rollouts.status.${v}`), value: v })),
);
const targetItems = computed(() =>
  COMMITMENT_TARGET_STATUS_VALUES.map((v) => ({ label: t(`rollouts.status.${v}`), value: v })),
);

function monthLabel(monthStart: string) {
  return new Date(`${monthStart}T00:00:00`).toLocaleDateString(intlLocale.value, {
    month: "long",
    year: "numeric",
  });
}

function notify(error?: string) {
  if (error) toast.add({ title: error, color: "error" });
}

async function changeStatus(status: RolloutStatus) {
  if (rollout.value) notify((await setRolloutStatus(rollout.value.id, status)).error);
}

// ---- tasks ของ rollout นี้
const tasks = ref<Task[]>([]);
watch(
  () => [open.value, rollout.value?.customer_id, rollout.value?.feature_id] as const,
  async ([isOpen, customerId, featureId]) => {
    if (!isOpen || !customerId || !featureId) return;
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status, task_type, profiles:assignee_id(id, full_name, email)")
      .eq("customer_id", customerId)
      .eq("feature_id", featureId)
      .not("status", "in", `(${TASK_CLOSED_STATUSES.join(",")})`)
      .order("updated_at", { ascending: false });
    tasks.value = (data ?? []) as unknown as Task[];
  },
  { immediate: true },
);

// ---- เพิ่ม commitment
const newMonth = ref("");
const newTarget = ref<CommitmentTargetStatus>("production");
async function addCommitment() {
  if (!rollout.value || !newMonth.value) return;
  const { error } = await createCommitment(rollout.value.id, monthInputToStart(newMonth.value), newTarget.value);
  notify(error);
  if (!error) newMonth.value = "";
}

// ---- เลื่อนเดือน
const rescheduling = ref<string | null>(null);
const reschedule = reactive({ month: "", reason: "" });
function startReschedule(c: Commitment) {
  rescheduling.value = c.id;
  reschedule.month = c.month.slice(0, 7);
  reschedule.reason = "";
}
async function submitReschedule(c: Commitment) {
  const { error } = await rescheduleCommitment(c.id, c.month, monthInputToStart(reschedule.month), reschedule.reason);
  notify(error);
  if (!error) rescheduling.value = null;
}

async function removeCommitment(c: Commitment) {
  const ok = await confirm({
    title: t("rollouts.deleteCommitmentConfirm"),
    color: "error",
    confirmLabel: t("common.delete"),
  });
  if (ok) notify((await deleteCommitment(c.id)).error);
}

async function removeRollout() {
  if (!rollout.value) return;
  const ok = await confirm({
    title: t("rollouts.deleteRolloutConfirm"),
    color: "error",
    confirmLabel: t("common.delete"),
  });
  if (!ok) return;
  const { error } = await deleteRollout(rollout.value.id);
  notify(error);
  if (!error) open.value = false;
}
</script>

<template>
  <USlideover
    v-model:open="open"
    side="right"
    :title="rollout ? `${rollout.customers?.company || rollout.customers?.name} × ${rollout.features?.name}` : ''"
    :ui="{ content: 'w-[28rem] max-w-[95vw]' }"
  >
    <template #body>
      <div v-if="rollout" class="space-y-6">
        <section>
          <h3 class="mb-2 text-xs font-semibold uppercase text-slate-500">{{ t("rollouts.statusLabel") }}</h3>
          <USelect
            :model-value="rollout.status"
            :items="statusItems"
            :disabled="!canManage"
            class="w-full"
            @update:model-value="(v) => changeStatus(v as RolloutStatus)"
          />
        </section>

        <section>
          <h3 class="mb-2 text-xs font-semibold uppercase text-slate-500">{{ t("rollouts.commitments") }}</h3>
          <p v-if="!commitments.length" class="text-sm text-slate-400">{{ t("rollouts.noCommitments") }}</p>
          <ul class="space-y-3">
            <li v-for="c in commitments" :key="c.id" class="rounded-lg border border-slate-200 p-3">
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="font-medium text-slate-800">{{ monthLabel(c.month) }}</p>
                  <span
                    class="mt-1 inline-block rounded border px-1.5 py-0.5 text-xs"
                    :class="ROLLOUT_STATUS_STYLE[c.target_status]"
                  >
                    {{ t(`rollouts.status.${c.target_status}`) }}
                  </span>
                </div>
                <div v-if="canManage" class="flex shrink-0 gap-1">
                  <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-calendar-clock" :aria-label="t('rollouts.reschedule')" @click="startReschedule(c)" />
                  <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" :aria-label="t('common.delete')" @click="removeCommitment(c)" />
                </div>
              </div>

              <div v-if="rescheduling === c.id" class="mt-3 space-y-2 border-t border-slate-100 pt-3">
                <UInput v-model="reschedule.month" type="month" class="w-full" />
                <UInput v-model="reschedule.reason" :placeholder="t('rollouts.rescheduleReason')" class="w-full" />
                <div class="flex justify-end gap-2">
                  <UButton size="xs" variant="ghost" color="neutral" @click="rescheduling = null">{{ t("common.cancel") }}</UButton>
                  <UButton size="xs" :disabled="!reschedule.reason.trim() || !reschedule.month" @click="submitReschedule(c)">
                    {{ t("common.save") }}
                  </UButton>
                </div>
              </div>

              <ul v-if="c.commitment_reschedules?.length" class="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
                <li v-for="h in c.commitment_reschedules" :key="h.id">
                  {{ monthLabel(h.from_month) }} → {{ monthLabel(h.to_month) }} — {{ h.reason }}
                </li>
              </ul>
            </li>
          </ul>

          <div v-if="canManage" class="mt-3 flex gap-2">
            <UInput v-model="newMonth" type="month" class="flex-1" />
            <USelect v-model="newTarget" :items="targetItems" class="w-36" />
            <UButton :disabled="!newMonth" icon="i-lucide-plus" :aria-label="t('common.add')" @click="addCommitment" />
          </div>
        </section>

        <section>
          <h3 class="mb-2 text-xs font-semibold uppercase text-slate-500">
            {{ t("rollouts.openTasks") }} ({{ tasks.length }})
          </h3>
          <p v-if="!tasks.length" class="text-sm text-slate-400">{{ t("rollouts.noOpenTasks") }}</p>
          <NuxtLink
            :to="{ path: '/tasks/board', query: { customer: rollout.customer_id, feature: rollout.feature_id } }"
            class="mb-2 inline-block text-xs text-ocean-700 hover:underline"
          >
            {{ t("rollouts.viewAllTasks") }}
          </NuxtLink>
          <ul class="space-y-1">
            <li v-for="task in tasks" :key="task.id" class="flex items-center justify-between gap-2 rounded border border-slate-100 px-2 py-1.5 text-sm">
              <span class="truncate text-slate-700">{{ task.title }}</span>
              <span class="shrink-0 text-xs text-slate-400">{{ t(`status.${task.status}`) }}</span>
            </li>
          </ul>
        </section>

        <UButton v-if="canManage" color="error" variant="ghost" icon="i-lucide-trash-2" @click="removeRollout">
          {{ t("rollouts.deleteRollout") }}
        </UButton>
      </div>
    </template>
  </USlideover>
</template>
