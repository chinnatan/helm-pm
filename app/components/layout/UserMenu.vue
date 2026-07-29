<script setup lang="ts">
import type { TaskCardDensity, NotificationPreferences } from "~/types";
import { TASK_CARD_DENSITY_VALUES } from "~/types";

const NOTIFICATION_PREF_KEYS = [
  "mention",
  "task_assigned",
  "task_tester_assigned",
  "task_status_changed",
  "task_due_date_changed",
  "task_priority_changed",
  "capacity",
] as const;
const emit = defineEmits<{
  "sign-out": [];
}>();

const { t } = useI18n();
const user = useSupabaseUser();
const {
  profile,
  displayName,
  initials,
  taskCardDensity,
  fetchMyProfile,
  updateProfile,
  updateTaskCardDensity,
  uploadAvatar,
  changePassword,
  updateNotificationPreferences,
} = useProfile();

const { configured: pushConfigured, browserPushEnabled, subscribed, requestPushPermission, refreshSubscriptionState } =
  useWebPush();

const open = ref(false);
const saving = ref(false);
const savingPassword = ref(false);
const savingDensity = ref(false);
const densityError = ref("");
const error = ref("");
const passwordError = ref("");
const passwordSuccess = ref("");

const form = reactive({
  first_name: "",
  last_name: "",
});

const passwordForm = reactive({
  current: "",
  next: "",
  confirm: "",
});

const avatarFile = ref<File | null>(null);
const avatarPreview = ref<string | null>(null);
const pushBusy = ref(false);
const pushError = ref("");

const notificationPrefs = computed(
  () => profile.value?.notification_preferences ?? {},
);

const pushStatusLabel = computed(() => {
  if (!pushConfigured.value) return t("profile.webPush.notConfigured");
  if (subscribed.value === true) return t("profile.webPush.subscribed");
  if (subscribed.value === false) return t("profile.webPush.notSubscribed");
  return t("profile.webPush.unknown");
});

async function onEnablePush() {
  pushError.value = "";
  pushBusy.value = true;
  try {
    const { error: err } = await requestPushPermission();
    if (err === "not_configured") {
      pushError.value = t("profile.webPush.notConfigured");
    } else if (err === "permission_denied") {
      pushError.value = t("profile.webPush.permissionDenied");
    } else if (err === "sdk_timeout") {
      pushError.value = t("profile.webPush.sdkTimeout");
    } else if (err === "wrong_site") {
      pushError.value = t("profile.webPush.wrongSite");
    } else if (err) {
      pushError.value = err;
    }
    await refreshSubscriptionState();
  } finally {
    pushBusy.value = false;
  }
}

async function toggleWebPushEnabled(enabled: boolean) {
  await updateNotificationPreferences({ web_push_enabled: enabled });
}

async function togglePref(key: (typeof NOTIFICATION_PREF_KEYS)[number], enabled: boolean) {
  await updateNotificationPreferences({ [key]: enabled } as NotificationPreferences);
}

const shownAvatar = computed(
  () => avatarPreview.value || profile.value?.avatar_url || null,
);

function openModal() {
  error.value = "";
  densityError.value = "";
  passwordError.value = "";
  passwordSuccess.value = "";
  pushError.value = "";
  form.first_name = profile.value?.first_name ?? "";
  form.last_name = profile.value?.last_name ?? "";
  passwordForm.current = "";
  passwordForm.next = "";
  passwordForm.confirm = "";
  clearAvatarPick();
  open.value = true;
  void refreshSubscriptionState();
}

function onAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value);
  avatarFile.value = file;
  avatarPreview.value = file ? URL.createObjectURL(file) : null;
}

function clearAvatarPick() {
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value);
  avatarFile.value = null;
  avatarPreview.value = null;
}

async function saveProfile() {
  error.value = "";
  if (!form.first_name.trim() || !form.last_name.trim()) {
    error.value = t("auth.nameRequired");
    return;
  }

  saving.value = true;

  const { error: updateError } = await updateProfile({
    first_name: form.first_name,
    last_name: form.last_name,
  });

  if (updateError) {
    saving.value = false;
    error.value = updateError === "name_required" ? t("auth.nameRequired") : updateError;
    return;
  }

  if (avatarFile.value) {
    const { error: avatarError } = await uploadAvatar(avatarFile.value);
    if (avatarError) {
      saving.value = false;
      error.value = avatarError;
      return;
    }
  }

  saving.value = false;
  clearAvatarPick();
  open.value = false;
}

async function savePassword() {
  passwordError.value = "";
  passwordSuccess.value = "";

  if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
    passwordError.value = t("profile.passwordFieldsRequired");
    return;
  }
  if (passwordForm.next.length < 6) {
    passwordError.value = t("profile.passwordTooShort");
    return;
  }
  if (passwordForm.next !== passwordForm.confirm) {
    passwordError.value = t("profile.passwordMismatch");
    return;
  }

  savingPassword.value = true;
  const { error: pwError } = await changePassword(
    passwordForm.current,
    passwordForm.next,
  );
  savingPassword.value = false;

  if (pwError === "current_password_invalid") {
    passwordError.value = t("profile.currentPasswordInvalid");
    return;
  }
  if (pwError) {
    passwordError.value = pwError;
    return;
  }

  passwordForm.current = "";
  passwordForm.next = "";
  passwordForm.confirm = "";
  passwordSuccess.value = t("profile.passwordChanged");
}

const densityOptions = computed(() =>
  TASK_CARD_DENSITY_VALUES.map((value) => ({
    value,
    label: t(`profile.taskCard.${value}`),
    description: t(`profile.taskCard.${value}Desc`),
  })),
);

async function onDensityChange(density: TaskCardDensity) {
  if (density === taskCardDensity.value || savingDensity.value) return;
  densityError.value = "";
  savingDensity.value = true;
  const { error: err } = await updateTaskCardDensity(density);
  savingDensity.value = false;
  if (err) densityError.value = err;
}

onMounted(() => {
  fetchMyProfile();
});

watch(
  () => user.value?.id,
  () => {
    fetchMyProfile();
  },
);

onUnmounted(() => {
  clearAvatarPick();
});
</script>

<template>
  <div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-ocean-50"
        :aria-label="t('profile.edit')"
        @click="openModal"
      >
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ocean-100 text-xs font-semibold text-ocean-900"
        >
          <img
            v-if="profile?.avatar_url"
            :src="profile.avatar_url"
            alt=""
            class="h-full w-full object-cover"
          >
          <span v-else>{{ initials }}</span>
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-medium text-slate-800">
            {{ displayName }}
          </span>
          <span class="block truncate text-xs text-slate-400">
            {{ profile?.email || user?.email }}
          </span>
        </span>
        <UIcon name="i-lucide-pencil" class="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      <UButton
        icon="i-lucide-log-out"
        variant="ghost"
        color="neutral"
        size="xs"
        :aria-label="t('common.signOut')"
        @click="emit('sign-out')"
      />
    </div>

    <UModal v-model:open="open" :title="t('profile.edit')">
      <template #body>
        <div class="space-y-5">
          <UAlert v-if="error" color="error" variant="subtle" :title="error" />

          <UFormField :label="t('auth.avatar')">
            <div class="flex items-center gap-3">
              <div
                class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-semibold text-slate-500"
              >
                <img
                  v-if="shownAvatar"
                  :src="shownAvatar"
                  alt=""
                  class="h-full w-full object-cover"
                >
                <span v-else>{{ initials }}</span>
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
                  @click="clearAvatarPick"
                >
                  {{ t("auth.removeAvatar") }}
                </button>
              </div>
            </div>
          </UFormField>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UFormField :label="t('auth.firstName')" required>
              <UInput v-model="form.first_name" class="w-full" />
            </UFormField>
            <UFormField :label="t('auth.lastName')" required>
              <UInput v-model="form.last_name" class="w-full" />
            </UFormField>
          </div>

          <UFormField :label="t('auth.email')" :hint="t('profile.emailReadonly')">
            <UInput
              :model-value="profile?.email || user?.email || ''"
              disabled
              class="w-full"
            />
          </UFormField>

          <div class="border-t border-slate-100 pt-4">
            <h3 class="mb-1 text-sm font-semibold text-slate-800">
              {{ t("profile.webPush.title") }}
            </h3>
            <p class="mb-3 text-xs text-slate-500">
              {{ t("profile.webPush.hint") }}
            </p>
            <p class="mb-2 text-xs text-slate-500">
              {{ t("profile.webPush.pwaHint") }}
            </p>
            <UAlert
              v-if="pushError"
              color="error"
              variant="subtle"
              class="mb-3"
              :title="pushError"
            />
            <p class="mb-3 text-sm text-slate-600">
              {{ pushStatusLabel }}
            </p>
            <div v-if="!browserPushEnabled" class="mb-4 flex flex-wrap gap-2">
              <UButton
                variant="outline"
                color="neutral"
                :loading="pushBusy"
                :disabled="!pushConfigured"
                @click="onEnablePush"
              >
                {{ t("profile.webPush.enable") }}
              </UButton>
            </div>
            <template v-if="pushConfigured">
              <p class="mb-2 text-xs font-medium text-slate-700">
                {{ t("profile.webPush.prefsTitle") }}
              </p>
              <label class="mb-2 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  :checked="notificationPrefs.web_push_enabled !== false"
                  @change="
                    toggleWebPushEnabled(
                      ($event.target as HTMLInputElement).checked,
                    )
                  "
                >
                {{ t("profile.webPush.webPushEnabled") }}
              </label>
              <label
                v-for="key in NOTIFICATION_PREF_KEYS"
                :key="key"
                class="mb-1 flex items-center gap-2 text-sm text-slate-600"
              >
                <input
                  type="checkbox"
                  :checked="notificationPrefs[key] !== false"
                  @change="
                    togglePref(key, ($event.target as HTMLInputElement).checked)
                  "
                >
                {{ t(`profile.webPush.types.${key}`) }}
              </label>
            </template>
          </div>

          <div class="border-t border-slate-100 pt-4">
            <h3 class="mb-1 text-sm font-semibold text-slate-800">
              {{ t("profile.taskCard.title") }}
            </h3>
            <p class="mb-3 text-xs text-slate-500">
              {{ t("profile.taskCard.hint") }}
            </p>
            <UAlert
              v-if="densityError"
              color="error"
              variant="subtle"
              class="mb-3"
              :title="densityError"
            />
            <div class="space-y-2">
              <button
                v-for="opt in densityOptions"
                :key="opt.value"
                type="button"
                class="flex w-full flex-col rounded-lg border px-3 py-2.5 text-left transition-colors"
                :class="
                  taskCardDensity === opt.value
                    ? 'border-ocean-600 bg-ocean-50'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                "
                :disabled="savingDensity"
                @click="onDensityChange(opt.value)"
              >
                <span class="text-sm font-medium text-slate-800">{{ opt.label }}</span>
                <span class="text-xs text-slate-500">{{ opt.description }}</span>
              </button>
            </div>
          </div>

          <div class="border-t border-slate-100 pt-4">
            <h3 class="mb-3 text-sm font-semibold text-slate-800">
              {{ t("profile.changePassword") }}
            </h3>
            <UAlert
              v-if="passwordError"
              color="error"
              variant="subtle"
              class="mb-3"
              :title="passwordError"
            />
            <UAlert
              v-if="passwordSuccess"
              color="success"
              variant="subtle"
              class="mb-3"
              :title="passwordSuccess"
            />
            <div class="space-y-3">
              <UFormField :label="t('profile.currentPassword')">
                <UInput
                  v-model="passwordForm.current"
                  type="password"
                  autocomplete="current-password"
                  class="w-full"
                />
              </UFormField>
              <UFormField :label="t('profile.newPassword')">
                <UInput
                  v-model="passwordForm.next"
                  type="password"
                  autocomplete="new-password"
                  class="w-full"
                />
              </UFormField>
              <UFormField :label="t('profile.confirmPassword')">
                <UInput
                  v-model="passwordForm.confirm"
                  type="password"
                  autocomplete="new-password"
                  class="w-full"
                />
              </UFormField>
              <UButton
                variant="outline"
                color="neutral"
                :loading="savingPassword"
                @click="savePassword"
              >
                {{ t("profile.updatePassword") }}
              </UButton>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="open = false">
            {{ t("common.cancel") }}
          </UButton>
          <UButton :loading="saving" @click="saveProfile">
            {{ t("common.save") }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
