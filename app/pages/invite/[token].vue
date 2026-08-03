<script setup lang="ts">
import type { InvitePreview } from "~/types";
import { format, parseISO } from "date-fns";

definePageMeta({ layout: "auth" });

const { t } = useI18n();
const route = useRoute();
const user = useSupabaseUser();
const { previewInvite, acceptInvite } = useWorkspaceInvites();
const { fetchWorkspace } = useWorkspace();

const token = computed(() => String(route.params.token ?? ""));
const preview = ref<InvitePreview | null>(null);
const loading = ref(true);
const accepting = ref(false);
const error = ref("");

onMounted(async () => {
  loading.value = true;
  const { data, error: err } = await previewInvite(token.value);
  preview.value = data;
  if (err) error.value = err;
  loading.value = false;
});

const loginHref = computed(
  () => `/login?redirect=${encodeURIComponent(`/invite/${token.value}`)}`,
);

async function handleAccept() {
  if (!user.value) {
    await navigateTo(loginHref.value);
    return;
  }

  accepting.value = true;
  error.value = "";
  const { data: workspaceId, error: err } = await acceptInvite(token.value);
  accepting.value = false;

  if (err || !workspaceId) {
    error.value = err ?? "Failed";
    const refreshed = await previewInvite(token.value);
    preview.value = refreshed.data;
    return;
  }

  await fetchWorkspace();
  await navigateTo("/projects");
}

function formatExpiry(iso?: string) {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "dd MMM yyyy HH:mm");
  } catch {
    return iso;
  }
}
</script>

<template>
  <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
    <div class="mb-6 text-center">
      <div
        class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-ocean-800 text-lg font-bold text-white"
      >
        H
      </div>
      <h1 class="text-xl font-bold text-ocean-900">{{ t("invite.title") }}</h1>
    </div>

    <div v-if="loading" class="py-8 text-center text-sm text-slate-500">
      {{ t("invite.loading") }}
    </div>

    <template v-else-if="preview">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        class="mb-4"
        :title="error"
      />

      <div
        v-if="preview.status !== 'valid'"
        class="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-600"
      >
        {{ t(`invite.status.${preview.status}`) }}
      </div>

      <template v-else>
        <div class="mb-6 space-y-2 text-sm">
          <p class="text-lg font-semibold text-slate-900">
            {{ preview.workspace_name }}
          </p>
          <p v-if="preview.invite_type === 'email' && preview.email" class="text-slate-500">
            {{ t("invite.forEmail", { email: preview.email }) }}
          </p>
          <p class="text-slate-500">
            {{ t("invite.role") }}:
            {{ t(`team.roles.${preview.role}`) }}
          </p>
          <p class="text-slate-500">
            {{ t("invite.expiresAt") }}: {{ formatExpiry(preview.expires_at) }}
          </p>
          <p
            v-if="(preview.max_uses ?? 1) > 1"
            class="text-slate-500"
          >
            {{
              t("invite.usesRemaining", {
                remaining: Math.max(0, (preview.max_uses ?? 1) - (preview.uses_count ?? 0)),
                max: preview.max_uses ?? 1,
              })
            }}
          </p>
        </div>

        <template v-if="!user">
          <p class="mb-4 text-center text-sm text-slate-500">
            {{ t("invite.signInFirst") }}
          </p>
          <div class="flex flex-col gap-2">
            <UButton block :to="loginHref">{{ t("invite.signIn") }}</UButton>
            <UButton block variant="ghost" :to="`${loginHref}&signup=1`">
              {{ t("invite.signUp") }}
            </UButton>
          </div>
        </template>

        <UButton
          v-else
          block
          :loading="accepting"
          @click="handleAccept"
        >
          {{ accepting ? t("invite.joining") : t("invite.join") }}
        </UButton>
      </template>
    </template>
  </div>
</template>
