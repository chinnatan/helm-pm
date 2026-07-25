<script setup lang="ts">
const user = useSupabaseUser();
const supabase = useSupabaseClient();
const route = useRoute();
const { t, locale, setLocale } = useI18n();

const navItems = computed(() => [
  { label: t("nav.planner"), to: "/planner", icon: "i-lucide-calendar-days" },
  { label: t("nav.projects"), to: "/projects", icon: "i-lucide-folder-kanban" },
  { label: t("nav.team"), to: "/team", icon: "i-lucide-users" },
]);

async function signOut() {
  await supabase.auth.signOut();
  navigateTo("/login");
}

function isActive(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`);
}

async function switchLocale(code: "th" | "en") {
  await setLocale(code);
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
        <div class="mb-2 flex items-center gap-1 px-2">
          <UButton
            size="xs"
            :variant="locale === 'th' ? 'solid' : 'ghost'"
            color="neutral"
            @click="switchLocale('th')"
          >
            {{ t("language.th") }}
          </UButton>
          <UButton
            size="xs"
            :variant="locale === 'en' ? 'solid' : 'ghost'"
            color="neutral"
            @click="switchLocale('en')"
          >
            {{ t("language.en") }}
          </UButton>
        </div>
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
            :aria-label="t('common.signOut')"
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
