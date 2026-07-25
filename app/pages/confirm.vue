<script setup lang="ts">
const { t } = useI18n();
const user = useSupabaseUser();

watch(
  user,
  () => {
    if (user.value) {
      navigateTo("/planner");
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <div class="text-center">
      <UIcon name="i-lucide-loader-2" class="mx-auto h-8 w-8 animate-spin text-slate-400" />
      <p class="mt-4 text-slate-600">{{ t("auth.confirming") }}</p>
    </div>
  </div>
</template>
