<script setup lang="ts">
definePageMeta({ layout: "auth", middleware: "guest" });

const { t, locale, setLocale } = useI18n();
const supabase = useSupabaseClient();
const email = ref("");
const password = ref("");
const isSignUp = ref(false);
const loading = ref(false);
const error = ref("");

async function handleEmailAuth() {
  loading.value = true;
  error.value = "";

  const { error: authError } = isSignUp.value
    ? await supabase.auth.signUp({ email: email.value, password: password.value })
    : await supabase.auth.signInWithPassword({ email: email.value, password: password.value });

  loading.value = false;

  if (authError) {
    error.value = authError.message;
    return;
  }

  if (!isSignUp.value) {
    navigateTo("/planner");
  } else {
    error.value = t("auth.checkEmail");
  }
}

async function handleGoogleAuth() {
  loading.value = true;
  error.value = "";

  const { error: authError } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${useRuntimeConfig().public.appUrl}/confirm`,
    },
  });

  loading.value = false;
  if (authError) {
    error.value = authError.message;
  }
}
</script>

<template>
  <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
    <div class="mb-4 flex justify-end gap-1">
      <UButton
        size="xs"
        :variant="locale === 'th' ? 'solid' : 'ghost'"
        color="neutral"
        @click="setLocale('th')"
      >
        {{ t("language.th") }}
      </UButton>
      <UButton
        size="xs"
        :variant="locale === 'en' ? 'solid' : 'ghost'"
        color="neutral"
        @click="setLocale('en')"
      >
        {{ t("language.en") }}
      </UButton>
    </div>

    <div class="mb-8 text-center">
      <div
        class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-ocean-800 text-lg font-bold text-white"
      >
        H
      </div>
      <h1 class="text-2xl font-bold text-ocean-900">Helm</h1>
      <p class="mt-1 text-sm text-slate-500">{{ t("auth.tagline") }}</p>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" />

    <form class="space-y-4" @submit.prevent="handleEmailAuth">
      <UFormField :label="t('auth.email')">
        <UInput v-model="email" type="email" placeholder="you@example.com" required class="w-full" />
      </UFormField>

      <UFormField :label="t('auth.password')">
        <UInput v-model="password" type="password" placeholder="••••••••" required class="w-full" />
      </UFormField>

      <UButton type="submit" block :loading="loading">
        {{ isSignUp ? t("auth.signUp") : t("auth.signIn") }}
      </UButton>
    </form>

    <div class="my-4 flex items-center gap-3">
      <div class="h-px flex-1 bg-slate-200" />
      <span class="text-xs text-slate-400">{{ t("auth.or") }}</span>
      <div class="h-px flex-1 bg-slate-200" />
    </div>

    <UButton
      block
      variant="outline"
      color="neutral"
      icon="i-simple-icons-google"
      :loading="loading"
      @click="handleGoogleAuth"
    >
      {{ t("auth.signInWithGoogle") }}
    </UButton>

    <p class="mt-6 text-center text-sm text-slate-500">
      <button
        type="button"
        class="text-ocean-800 underline hover:text-ocean-900"
        @click="isSignUp = !isSignUp"
      >
        {{ isSignUp ? t("auth.haveAccount") : t("auth.noAccount") }}
      </button>
    </p>
  </div>
</template>
