<script setup lang="ts">
definePageMeta({ layout: "auth", middleware: "guest" });

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
    error.value = "ตรวจสอบอีเมลเพื่อยืนยันบัญชี";
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
    <div class="mb-8 text-center">
      <div
        class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-lg font-bold text-white"
      >
        H
      </div>
      <h1 class="text-2xl font-bold text-slate-900">Helm</h1>
      <p class="mt-1 text-sm text-slate-500">Project Management — steer the ship</p>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" />

    <form class="space-y-4" @submit.prevent="handleEmailAuth">
      <UFormField label="อีเมล">
        <UInput v-model="email" type="email" placeholder="you@example.com" required class="w-full" />
      </UFormField>

      <UFormField label="รหัสผ่าน">
        <UInput v-model="password" type="password" placeholder="••••••••" required class="w-full" />
      </UFormField>

      <UButton type="submit" block :loading="loading">
        {{ isSignUp ? "สมัครสมาชิก" : "เข้าสู่ระบบ" }}
      </UButton>
    </form>

    <div class="my-4 flex items-center gap-3">
      <div class="h-px flex-1 bg-slate-200" />
      <span class="text-xs text-slate-400">หรือ</span>
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
      เข้าสู่ระบบด้วย Google
    </UButton>

    <p class="mt-6 text-center text-sm text-slate-500">
      <button
        type="button"
        class="text-slate-700 underline hover:text-slate-900"
        @click="isSignUp = !isSignUp"
      >
        {{ isSignUp ? "มีบัญชีแล้ว? เข้าสู่ระบบ" : "ยังไม่มีบัญชี? สมัครสมาชิก" }}
      </button>
    </p>
  </div>
</template>
