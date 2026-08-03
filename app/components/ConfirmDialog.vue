<script setup lang="ts">
const { t } = useI18n();
const { open, options, respond } = useConfirmDialog();

const title = computed(() => options.value?.title ?? "");
const description = computed(() => options.value?.description ?? "");
const confirmLabel = computed(
  () => options.value?.confirmLabel ?? t("common.delete"),
);
const cancelLabel = computed(
  () => options.value?.cancelLabel ?? t("common.cancel"),
);
const color = computed(() => options.value?.color ?? "error");
const icon = computed(
  () =>
    options.value?.icon ??
    (color.value === "warning" ? "i-lucide-archive" : "i-lucide-triangle-alert"),
);

const iconWrapClass = computed(() => {
  switch (color.value) {
    case "warning":
      return "bg-amber-50 text-amber-700";
    case "primary":
      return "bg-ocean-50 text-ocean-800";
    case "neutral":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-red-50 text-red-600";
  }
});
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #body>
      <div class="flex gap-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          :class="iconWrapClass"
        >
          <UIcon :name="icon" class="h-5 w-5" />
        </div>
        <p class="pt-1.5 text-sm leading-relaxed text-slate-600">
          {{ description }}
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="respond(false)">
          {{ cancelLabel }}
        </UButton>
        <UButton :color="color" @click="respond(true)">
          {{ confirmLabel }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
