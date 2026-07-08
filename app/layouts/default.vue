<script setup lang="ts">
const user = useSupabaseUser();
const supabase = useSupabaseClient();
const route = useRoute();

const navItems = [
  { label: "My Planner", to: "/planner", icon: "i-lucide-calendar-days" },
  { label: "Projects", to: "/projects", icon: "i-lucide-folder-kanban" },
  { label: "Team", to: "/team", icon: "i-lucide-users" },
];

async function signOut() {
  await supabase.auth.signOut();
  navigateTo("/login");
}

function isActive(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`);
}
</script>

<template>
  <div class="flex min-h-screen bg-slate-50">
    <aside class="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div class="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-sm font-bold text-white"
        >
          H
        </div>
        <span class="text-lg font-semibold text-slate-800">Helm</span>
      </div>

      <nav class="flex-1 space-y-1 p-3">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="
            isActive(item.to)
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          "
        >
          <UIcon :name="item.icon" class="h-4 w-4" />
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="border-t border-slate-200 p-3">
        <div class="flex items-center justify-between rounded-lg px-2 py-2">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-slate-800">
              {{ user?.email }}
            </p>
          </div>
          <UButton
            icon="i-lucide-log-out"
            variant="ghost"
            color="neutral"
            size="xs"
            aria-label="Sign out"
            @click="signOut"
          />
        </div>
      </div>
    </aside>

    <main class="flex-1 overflow-auto">
      <slot />
    </main>
  </div>
</template>
