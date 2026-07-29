<script setup lang="ts">
import type { Notification } from "~/types";

const { t } = useI18n();
const { toLocaleString } = useDateLocale();
const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

const open = ref(false);

async function onNotificationClick(n: Notification) {
  await markRead(n.id);
  open.value = false;

  const meta = n.metadata as { project_id?: string } | null | undefined;
  const projectId = meta?.project_id;

  if (projectId && n.task_id) {
    await navigateTo(`/projects/${projectId}/board?task=${n.task_id}`);
  } else if (projectId) {
    await navigateTo(`/projects/${projectId}`);
  }
}

</script>

<template>
  <UPopover v-model:open="open">
    <UButton
      icon="i-lucide-bell"
      variant="ghost"
      color="neutral"
      :aria-label="t('notifications.ariaLabel')"
      class="relative"
    >
      <UBadge
        v-if="unreadCount > 0"
        :label="String(unreadCount)"
        color="error"
        size="xs"
        class="absolute -right-1 -top-1"
      />
    </UButton>

    <template #content>
      <div class="w-[min(20rem,calc(100vw-2rem))] p-2">
        <div class="mb-2 flex items-center justify-between px-2">
          <h3 class="text-sm font-semibold">{{ t("notifications.title") }}</h3>
          <UButton v-if="unreadCount > 0" variant="link" size="xs" @click="markAllRead">
            {{ t("notifications.markAllRead") }}
          </UButton>
        </div>

        <div v-if="notifications.length === 0" class="px-2 py-4 text-center text-sm text-slate-400">
          {{ t("notifications.empty") }}
        </div>

        <div
          v-for="n in notifications"
          :key="n.id"
          class="cursor-pointer rounded-lg px-2 py-2 text-sm hover:bg-slate-50"
          :class="!n.read ? 'bg-blue-50' : ''"
          @click="onNotificationClick(n)"
        >
          <p class="text-slate-700">{{ n.message }}</p>
          <p class="text-xs text-slate-400">{{ toLocaleString(n.created_at) }}</p>
        </div>
      </div>
    </template>
  </UPopover>
</template>
