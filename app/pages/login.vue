<script setup lang="ts">
definePageMeta({ layout: "auth", middleware: "guest" });

const { t, locale, setLocale } = useI18n();
const supabase = useSupabaseClient();

const email = ref("");
const password = ref("");
const firstName = ref("");
const lastName = ref("");
const avatarFile = ref<File | null>(null);
const avatarPreview = ref<string | null>(null);
const isSignUp = ref(false);
const loading = ref(false);
const error = ref("");

function onAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value);
  avatarFile.value = file;
  avatarPreview.value = file ? URL.createObjectURL(file) : null;
}

function clearAvatar() {
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value);
  avatarFile.value = null;
  avatarPreview.value = null;
}

async function uploadAvatar(userId: string, file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: urlData.publicUrl })
    .eq("id", userId);

  return { error: updateError?.message };
}

async function handleEmailAuth() {
  loading.value = true;
  error.value = "";

  if (isSignUp.value) {
    if (!firstName.value.trim() || !lastName.value.trim()) {
      error.value = t("auth.nameRequired");
      loading.value = false;
      return;
    }

    const first = firstName.value.trim();
    const last = lastName.value.trim();
    const fullName = `${first} ${last}`;

    const { data, error: authError } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        data: {
          first_name: first,
          last_name: last,
          full_name: fullName,
        },
      },
    });

    if (authError) {
      loading.value = false;
      error.value = authError.message;
      return;
    }

    if (data.session?.user && avatarFile.value) {
      const { error: avatarError } = await uploadAvatar(
        data.session.user.id,
        avatarFile.value,
      );
      if (avatarError) {
        // Account created; avatar is optional — surface but continue
        console.warn("avatar upload failed:", avatarError);
      }
    }

    loading.value = false;

    if (data.session) {
      navigateTo("/planner");
    } else {
      error.value = t("auth.checkEmail");
    }
    return;
  }

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  });

  loading.value = false;

  if (authError) {
    error.value = authError.message;
    return;
  }

  navigateTo("/planner");
}

watch(isSignUp, (signingUp) => {
  if (!signingUp) {
    firstName.value = "";
    lastName.value = "";
    clearAvatar();
  }
  error.value = "";
});

onUnmounted(() => {
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value);
});
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
      <template v-if="isSignUp">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField :label="t('auth.firstName')" required>
            <UInput
              v-model="firstName"
              :placeholder="t('auth.firstNamePlaceholder')"
              required
              autocomplete="given-name"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('auth.lastName')" required>
            <UInput
              v-model="lastName"
              :placeholder="t('auth.lastNamePlaceholder')"
              required
              autocomplete="family-name"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField :label="t('auth.avatar')" :hint="t('auth.avatarOptional')">
          <div class="flex items-center gap-3">
            <div
              class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400"
            >
              <img
                v-if="avatarPreview"
                :src="avatarPreview"
                alt=""
                class="h-full w-full object-cover"
              >
              <UIcon v-else name="i-lucide-user" class="h-6 w-6" />
            </div>
            <div class="min-w-0 flex-1 space-y-1">
              <input
                type="file"
                accept="image/*"
                class="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-ocean-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ocean-900 hover:file:bg-ocean-200"
                @change="onAvatarChange"
              >
              <button
                v-if="avatarFile"
                type="button"
                class="text-xs text-slate-500 underline hover:text-slate-700"
                @click="clearAvatar"
              >
                {{ t("auth.removeAvatar") }}
              </button>
            </div>
          </div>
        </UFormField>
      </template>

      <UFormField :label="t('auth.email')">
        <UInput
          v-model="email"
          type="email"
          placeholder="you@example.com"
          required
          autocomplete="email"
          class="w-full"
        />
      </UFormField>

      <UFormField :label="t('auth.password')">
        <UInput
          v-model="password"
          type="password"
          placeholder="••••••••"
          required
          :autocomplete="isSignUp ? 'new-password' : 'current-password'"
          class="w-full"
        />
      </UFormField>

      <UButton type="submit" block :loading="loading">
        {{ isSignUp ? t("auth.signUp") : t("auth.signIn") }}
      </UButton>
    </form>

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
