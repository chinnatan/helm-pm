<script setup lang="ts">
const { notifications, unreadCount, fetchNotifications, markRead, markAllRead, subscribe } =
  useNotifications();

const open = ref(false);

onMounted(async () => {
  await fetchNotifications();
  const unsub = subscribe();
  onUnmounted(unsub);
});
</script>

<template>
  <UPopover v-model:open="open">
    <UButton
      icon="i-lucide-bell"
      variant="ghost"
      color="neutral"
      aria-label="Notifications"
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
      <div class="w-80 p-2">
        <div class="mb-2 flex items-center justify-between px-2">
          <h3 class="text-sm font-semibold">Notifications</h3>
          <UButton v-if="unreadCount > 0" variant="link" size="xs" @click="markAllRead">
            Mark all read
          </UButton>
        </div>

        <div v-if="notifications.length === 0" class="px-2 py-4 text-center text-sm text-slate-400">
          No notifications
        </div>

        <div
          v-for="n in notifications"
          :key="n.id"
          class="cursor-pointer rounded-lg px-2 py-2 text-sm hover:bg-slate-50"
          :class="!n.read ? 'bg-blue-50' : ''"
          @click="markRead(n.id)"
        >
          <p class="text-slate-700">{{ n.message }}</p>
          <p class="text-xs text-slate-400">{{ new Date(n.created_at).toLocaleString() }}</p>
        </div>
      </div>
    </template>
  </UPopover>
</template>
