<script setup lang="ts">
import type { Customer, ResponseStatus } from "~/types";
import { format, subDays } from "date-fns";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const toast = useToast();
const route = useRoute();
const supabase = useSupabaseClient();
const customerId = computed(() => route.params.id as string);

const { fetchWorkspace } = useWorkspace();
const { getCustomer, fetchCustomers } = useCustomers();

const customer = ref<Customer | null>(null);
const loading = ref(true);
const items = ref<IssueLogItem[]>([]);

const today = format(new Date(), "yyyy-MM-dd");
const from = ref(format(subDays(new Date(), 30), "yyyy-MM-dd"));
const to = ref(today);
const forCustomer = ref(true);
const intro = ref("");

async function fetchItems() {
  const { data, error } = await supabase
    .from("tasks")
    .select("title, response_status, response_text, customer_visible, requested_on, features:feature_id(name)")
    .eq("customer_id", customerId.value)
    .eq("task_type", "customer-request")
    .gte("requested_on", from.value)
    .lte("requested_on", to.value)
    .order("requested_on")
    .order("created_at");
  if (error) {
    toast.add({ title: error.message, color: "error" });
    return;
  }
  items.value = ((data ?? []) as unknown as {
    title: string;
    response_status: ResponseStatus | null;
    response_text: string | null;
    customer_visible: boolean;
    requested_on: string;
    features: { name: string } | null;
  }[]).map((r) => ({
    title: r.title,
    feature: r.features?.name ?? null,
    responseStatus: r.response_status,
    responseText: r.response_text,
    customerVisible: r.customer_visible,
    requestedOn: r.requested_on,
  }));
}

onMounted(async () => {
  await Promise.all([fetchWorkspace(), fetchCustomers()]);
  customer.value = await getCustomer(customerId.value);
  await fetchItems();
  loading.value = false;
});

watch([from, to], () => {
  if (from.value && to.value && from.value <= to.value) void fetchItems();
});

const markdown = computed(() =>
  buildIssueLogMarkdown(items.value, {
    forCustomer: forCustomer.value,
    intro: intro.value,
    statusLabel: (s) => t(`response.status.${s}`),
  }),
);

const visibleCount = computed(() => items.value.filter((i) => !forCustomer.value || i.customerVisible).length);
const hiddenCount = computed(() => items.value.length - visibleCount.value);

function print() {
  window.print();
}

async function copy() {
  try {
    await navigator.clipboard.writeText(markdown.value);
    toast.add({ title: t("issueLog.copied"), color: "success" });
  } catch {
    toast.add({ title: t("issueLog.copyFailed"), color: "error" });
  }
}
</script>

<template>
  <div class="p-4 md:p-6">
    <div class="mb-4 print:hidden">
      <NuxtLink :to="`/customers/${customerId}`" class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ocean-800">
        <UIcon name="i-lucide-arrow-left" class="h-4 w-4" />
        {{ customer?.name ?? t("customers.back") }}
      </NuxtLink>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-slate-400" />
    </div>

    <template v-else>
      <h1 class="mb-1 text-xl font-bold text-slate-900 sm:text-2xl print:text-black">
        {{ t("issueLog.title") }} — {{ customer?.name }}
      </h1>
      <p class="mb-4 text-sm text-slate-500 print:hidden">{{ t("issueLog.subtitle") }}</p>

      <div class="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 print:hidden">
        <UFormField :label="t('issueLog.from')">
          <UInput v-model="from" type="date" class="w-full" data-testid="issuelog-from" />
        </UFormField>
        <UFormField :label="t('issueLog.to')">
          <UInput v-model="to" type="date" class="w-full" data-testid="issuelog-to" />
        </UFormField>
        <div class="sm:col-span-2">
          <USwitch v-model="forCustomer" :label="t('issueLog.forCustomer')" data-testid="issuelog-for-customer" />
          <p class="mt-1 text-xs text-slate-500">
            {{ forCustomer ? t("issueLog.forCustomerHint", { n: hiddenCount }) : t("issueLog.internalHint") }}
          </p>
        </div>
        <UFormField class="sm:col-span-2" :label="t('issueLog.intro')">
          <UTextarea v-model="intro" :rows="3" class="w-full" :placeholder="t('issueLog.introPlaceholder')" />
        </UFormField>
      </div>

      <div class="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <span class="text-sm text-slate-500">{{ t("issueLog.count", { n: visibleCount }) }}</span>
        <UButton size="sm" icon="i-lucide-copy" :disabled="!markdown" data-testid="issuelog-copy" @click="copy">
          {{ t("issueLog.copy") }}
        </UButton>
        <UButton size="sm" variant="soft" icon="i-lucide-printer" :disabled="!markdown" @click="print">
          {{ t("issueLog.print") }}
        </UButton>
      </div>

      <pre
        v-if="markdown"
        class="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-800 print:border-0 print:p-0"
        data-testid="issuelog-preview"
      >{{ markdown }}</pre>
      <p v-else class="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
        {{ t("issueLog.empty") }}
      </p>
    </template>
  </div>
</template>
