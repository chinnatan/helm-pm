<script setup lang="ts">
const supabase = useSupabaseClient();
const route = useRoute();
const { t, locale, setLocale } = useI18n();

const menuOpen = ref(false);
const isDesktop = ref(
  import.meta.client ? window.matchMedia("(min-width: 768px)").matches : false,
);
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

const { projectsHomePath } = useLastProject();
const { isWorkspaceAdmin, fetchWorkspace } = useWorkspace();
const { fetchMyProfile } = useProfile();

onMounted(() => {
  fetchWorkspace();
  fetchMyProfile();
});

const navItems = computed(() => {
  const items = [
    { label: t("nav.planner"), to: "/planner", match: "/planner", icon: "i-lucide-calendar-days" },
    {
      label: t("nav.projects"),
      to: projectsHomePath.value,
      match: "/projects",
      icon: "i-lucide-folder-kanban",
    },
    { label: t("nav.customers"), to: "/customers", match: "/customers", icon: "i-lucide-building-2" },
    { label: t("nav.team"), to: "/team", match: "/team", icon: "i-lucide-users" },
  ];
  if (isWorkspaceAdmin.value) {
    items.push({
      label: t("nav.audit"),
      to: "/audit",
      match: "/audit",
      icon: "i-lucide-scroll-text",
    });
  }
  return items;
});

async function signOut() {
  await supabase.auth.signOut();
  navigateTo("/login");
}

function isActive(match: string) {
  return route.path === match || route.path.startsWith(`${match}/`);
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
  <div class="flex h-dvh overflow-hidden bg-ocean-50">
    <!-- Desktop sidebar -->
    <aside
      class="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex"
    >
      <!-- Header -->
      <div class="shrink-0 flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div class="flex items-center gap-2">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-ocean-800 text-sm font-bold text-white"
          >
            H
          </div>
          <span class="text-lg font-semibold text-ocean-900">Helm</span>
        </div>
        <LayoutNotificationBell v-if="isDesktop" />
      </div>

      <!-- Primary nav (pinned) -->
      <nav class="shrink-0 space-y-1 p-3">
        <NuxtLink
          v-for="item in navItems"
          :key="item.match"
          :to="item.to"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="
            isActive(item.match)
              ? 'bg-ocean-100 text-ocean-900'
              : 'text-slate-600 hover:bg-ocean-50 hover:text-ocean-900'
          "
        >
          <UIcon :name="item.icon" class="h-4 w-4" />
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- Context switchers (scrollable) -->
      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-3">
        <LayoutWorkspaceSwitcher />
        <LayoutProjectSwitcher />
      </div>

      <!-- Footer (pinned) -->
      <div class="shrink-0 border-t border-slate-200 p-3">
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
        <LayoutUserMenu @sign-out="signOut" />
      </div>
    </aside>

    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
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
              class="flex h-7 w-7 items-center justify-center rounded-lg bg-ocean-800 text-xs font-bold text-white"
            >
              H
            </div>
            <span class="text-base font-semibold text-ocean-900">Helm</span>
          </div>
        </div>
        <LayoutNotificationBell v-if="!isDesktop" />
      </header>

      <main class="min-h-0 flex-1 overflow-auto">
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
            :key="item.match"
            type="button"
            class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors"
            :class="
              isActive(item.match)
                ? 'bg-ocean-100 text-ocean-900'
                : 'text-slate-600 hover:bg-ocean-50 hover:text-ocean-900'
            "
            @click="navigateAndClose(item.to)"
          >
            <UIcon :name="item.icon" class="h-4 w-4" />
            {{ item.label }}
          </button>

          <div class="space-y-3 pt-3">
            <LayoutWorkspaceSwitcher @navigated="menuOpen = false" />
            <LayoutProjectSwitcher @navigated="menuOpen = false" />
          </div>
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
          <LayoutUserMenu @sign-out="signOut" />
        </div>
      </template>
    </USlideover>

    <ConfirmDialog />
  </div>
</template>
