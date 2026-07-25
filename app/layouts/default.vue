<script setup lang="ts">
const user = useSupabaseUser();
const supabase = useSupabaseClient();
const route = useRoute();
const { t, locale, setLocale } = useI18n();

const menuOpen = ref(false);
const isDesktop = ref(false);
let desktopMq: MediaQueryList | null = null;

function updateIsDesktop() {
  isDesktop.value = desktopMq?.matches ?? false;
}

onMounted(() => {
  desktopMq = window.matchMedia("(min-width: 768px)");
  updateIsDesktop();
  desktopMq.addEventListener("change", updateIsDesktop);
});

onUnmounted(() => {
  desktopMq?.removeEventListener("change", updateIsDesktop);
  desktopMq = null;
});

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

function navigateAndClose(to: string) {
  menuOpen.value = false;
  navigateTo(to);
}

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false;
  },
);
</script>

<template>
  <div class="flex min-h-screen bg-slate-50">
    <!-- Desktop sidebar -->
    <aside
      class="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex"
    >
      <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div class="flex items-center gap-2">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-sm font-bold text-white"
          >
            H
          </div>
          <span class="text-lg font-semibold text-slate-800">Helm</span>
        </div>
        <LayoutNotificationBell v-if="isDesktop" />
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

    <div class="flex min-w-0 flex-1 flex-col">
      <!-- Mobile top bar -->
      <header
        class="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden"
      >
        <div class="flex items-center gap-2">
          <UButton
            icon="i-lucide-menu"
            variant="ghost"
            color="neutral"
            size="sm"
            :aria-label="t('nav.openMenu')"
            @click="menuOpen = true"
          />
          <div class="flex items-center gap-2">
            <div
              class="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-white"
            >
              H
            </div>
            <span class="text-base font-semibold text-slate-800">Helm</span>
          </div>
        </div>
        <LayoutNotificationBell v-if="!isDesktop" />
      </header>

      <main class="flex-1 overflow-auto">
        <slot />
      </main>
    </div>

    <!-- Mobile nav drawer -->
    <USlideover
      v-model:open="menuOpen"
      side="left"
      :title="t('nav.menu')"
      :ui="{ content: 'w-72 max-w-[85vw]' }"
    >
      <template #body>
        <nav class="space-y-1">
          <button
            v-for="item in navItems"
            :key="item.to"
            type="button"
            class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors"
            :class="
              isActive(item.to)
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            "
            @click="navigateAndClose(item.to)"
          >
            <UIcon :name="item.icon" class="h-4 w-4" />
            {{ item.label }}
          </button>
        </nav>

        <div class="mt-6 border-t border-slate-200 pt-4">
          <div class="mb-3 flex items-center gap-1">
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
          <div class="flex items-center justify-between rounded-lg py-2">
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
      </template>
    </USlideover>
  </div>
</template>
