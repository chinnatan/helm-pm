<script setup lang="ts">
definePageMeta({ layout: "auth" });

const { t } = useI18n();
const user = useSupabaseUser();
const supabase = useSupabaseClient();

const error = ref("");
const timedOut = ref(false);

async function goApp() {
  await navigateTo("/planner", { replace: true });
}

onMounted(async () => {
  // getSession() waits for GoTrueClient.initialize(), which exchanges ?code= / hash tokens.
  const { data, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    error.value = sessionError.message;
    return;
  }

  if (data.session || user.value) {
    await goApp();
    return;
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      subscription.unsubscribe();
      void goApp();
    }
  });

  // If the link was already consumed or invalid, don't spin forever.
  window.setTimeout(() => {
    subscription.unsubscribe();
    if (!user.value) {
      timedOut.value = true;
      error.value = t("auth.confirmFailed");
    }
  }, 12_000);
});

watch(
  user,
  (u) => {
    if (u) void goApp();
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <div class="w-full max-w-sm text-center">
      <template v-if="!error">
        <UIcon name="i-lucide-loader-2" class="mx-auto h-8 w-8 animate-spin text-slate-400" />
        <p class="mt-4 text-slate-600">{{ t("auth.confirming") }}</p>
      </template>
      <template v-else>
        <UAlert color="error" variant="subtle" :title="error" class="mb-4 text-left" />
        <UButton to="/login" block>
          {{ timedOut ? t("auth.backToLogin") : t("auth.signIn") }}
        </UButton>
      </template>
    </div>
  </div>
</template>
