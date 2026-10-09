<script setup lang="ts">
import type { CustomerShare } from "~/types";
import { ROLLOUT_STATUS_STYLE } from "~/utils/rollout";

// หน้าสาธารณะ (ไม่มี auth middleware) — ข้อมูลมาจาก RPC get_customer_share เท่านั้น
definePageMeta({ layout: "public" });

const { t } = useI18n();
const { intlLocale } = useDateLocale();
const route = useRoute();
const supabase = useSupabaseClient();

const loading = ref(true);
const share = ref<CustomerShare | null>(null);

onMounted(async () => {
  const { data } = await supabase.rpc("get_customer_share", { p_token: route.params.token as string });
  share.value = (data as unknown as CustomerShare | null) ?? null;
  loading.value = false;
});

const valid = computed(() => share.value?.status === "valid");
const timeline = computed(() => groupShareTimeline(share.value?.rollouts ?? []));

function monthLabel(monthStart: string) {
  return new Date(`${monthStart}T00:00:00`).toLocaleDateString(intlLocale.value, { month: "long", year: "numeric" });
}

function dateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(intlLocale.value, { day: "numeric", month: "short", year: "numeric" });
}
</script>

<template>
  <div>
    <div v-if="loading" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-slate-400" />
    </div>

    <div v-else-if="!valid" class="rounded-xl border border-slate-200 bg-white p-8 text-center" data-testid="share-invalid">
      <UIcon name="i-lucide-link-2-off" class="mx-auto mb-3 h-10 w-10 text-slate-300" />
      <p class="font-medium text-slate-700">{{ t("share.invalidTitle") }}</p>
      <p class="mt-1 text-sm text-slate-500">{{ t("share.invalidHint") }}</p>
    </div>

    <template v-else>
      <header class="mb-6">
        <p class="text-sm text-slate-500">{{ t("share.subtitle") }}</p>
        <h1 class="text-2xl font-bold text-slate-900" data-testid="share-customer">
          {{ share?.customer?.company || share?.customer?.name }}
        </h1>
      </header>

      <section class="mb-8">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{{ t("share.timeline") }}</h2>
        <p v-if="!timeline.length" class="text-sm text-slate-400">{{ t("share.noTimeline") }}</p>
        <div class="space-y-4">
          <div v-for="group in timeline" :key="group.month ?? 'none'" class="rounded-xl border border-slate-200 bg-white p-4" data-testid="share-month">
            <h3 class="mb-2 font-semibold text-slate-800">{{ group.month ? monthLabel(group.month) : t("rollouts.noCommitment") }}</h3>
            <ul class="space-y-1.5">
              <li
                v-for="item in group.items"
                :key="item.feature"
                class="flex items-center justify-between gap-3 rounded-md border px-3 py-1.5 text-sm"
                :class="ROLLOUT_STATUS_STYLE[item.status]"
              >
                <span class="font-medium">{{ item.feature }}</span>
                <span class="text-xs">{{ t(`rollouts.status.${item.status}`) }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{{ t("share.requests") }}</h2>
        <p v-if="!share?.requests?.length" class="text-sm text-slate-400">{{ t("share.noRequests") }}</p>
        <ul class="space-y-3">
          <li v-for="(r, i) in share?.requests" :key="i" class="rounded-xl border border-slate-200 bg-white p-4" data-testid="share-request">
            <p class="text-xs text-slate-400">{{ dateLabel(r.requested_on) }}<template v-if="r.feature"> · {{ r.feature }}</template></p>
            <p class="mt-1 font-medium text-slate-800">{{ r.title }}</p>
            <div class="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <UBadge v-if="r.response_status" :color="r.response_status === 'rejected' ? 'neutral' : 'success'" variant="subtle" size="xs" class="mr-2">
                {{ t(`response.status.${r.response_status}`) }}
              </UBadge>
              <span v-if="r.response_text">{{ r.response_text }}</span>
              <span v-else-if="!r.response_status" class="text-slate-400">{{ t("share.awaiting") }}</span>
            </div>
          </li>
        </ul>
      </section>

      <p class="mt-8 text-xs text-slate-400">
        {{ t("share.expires", { date: share?.expires_at ? dateLabel(share.expires_at.slice(0, 10)) : "" }) }}
      </p>
    </template>
  </div>
</template>
