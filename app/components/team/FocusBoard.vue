<script setup lang="ts">
import { FOCUS_SOFT_LIMIT } from "~/composables/useTeamFocus";

const { t } = useI18n();
const toast = useToast();
const user = useSupabaseUser();
const { members, workspace } = useWorkspace();
const { loading, fetchTeamFocus, focusOf, reorderOwnFocus, unfocus } = useTeamFocus();

const expanded = ref<Set<string>>(new Set());

// workspace อาจยังโหลดไม่เสร็จตอน mount — รอ id ก่อนดึง
watch(() => workspace.value?.id, (id) => id && void fetchTeamFocus(), { immediate: true });

function toggleExpanded(userId: string) {
  const next = new Set(expanded.value);
  if (!next.delete(userId)) next.add(userId);
  expanded.value = next;
}

function visible(userId: string) {
  const all = focusOf(userId);
  return expanded.value.has(userId) ? all : all.slice(0, FOCUS_SOFT_LIMIT);
}

function notify(error?: string) {
  if (error) toast.add({ title: error, color: "error" });
}

async function move(userId: string, index: number, delta: -1 | 1) {
  const ids = focusOf(userId).map((e) => e.task.id);
  const target = index + delta;
  if (target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target]!, ids[index]!];
  notify((await reorderOwnFocus(ids)).error);
}

const cards = computed(() =>
  members.value
    .map((m) => ({ member: m, total: focusOf(m.user_id).length }))
    // คนที่มี focus ขึ้นก่อน แล้วเรียงตามชื่อ
    .sort(
      (a, b) =>
        Number(b.total > 0) - Number(a.total > 0) ||
        (a.member.profiles?.full_name || a.member.profiles?.email || "").localeCompare(
          b.member.profiles?.full_name || b.member.profiles?.email || "",
        ),
    ),
);
</script>

<template>
  <div>
    <p class="mb-4 max-w-3xl text-sm text-slate-500">{{ t("focus.hint") }}</p>

    <div v-if="loading && !cards.length" class="py-8 text-center text-sm text-slate-400">
      {{ t("common.loading") }}
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <section
        v-for="{ member, total } in cards"
        :key="member.id"
        class="rounded-xl border border-slate-200 bg-white p-4"
        data-testid="focus-card"
      >
        <header class="mb-3 flex items-center gap-2">
          <UserAvatar
            :src="member.profiles?.avatar_url"
            :name="member.profiles?.full_name"
            :email="member.profiles?.email"
            size="sm"
          />
          <p class="min-w-0 flex-1 truncate font-medium text-slate-800">
            {{ member.profiles?.full_name || member.profiles?.email }}
          </p>
          <UBadge
            :color="total > FOCUS_SOFT_LIMIT ? 'warning' : 'neutral'"
            variant="subtle"
            size="xs"
            :title="total > FOCUS_SOFT_LIMIT ? t('focus.overLimit', { n: FOCUS_SOFT_LIMIT }) : undefined"
          >
            {{ total }}
          </UBadge>
        </header>

        <p v-if="!total" class="text-sm text-slate-400">{{ t("focus.none") }}</p>
        <p v-if="member.user_id === user?.id && total > FOCUS_SOFT_LIMIT" class="mb-2 text-xs text-amber-700">
          {{ t("focus.overLimit", { n: FOCUS_SOFT_LIMIT }) }}
        </p>

        <ol class="space-y-2">
          <li
            v-for="(entry, i) in visible(member.user_id)"
            :key="entry.task.id"
            class="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
            data-testid="focus-item"
          >
            <div class="flex items-start gap-2">
              <span class="mt-0.5 text-xs font-semibold text-slate-400">{{ i + 1 }}</span>
              <div class="min-w-0 flex-1">
                <NuxtLink
                  :to="{ path: '/tasks/board', query: { task: entry.task.id } }"
                  class="block truncate text-sm font-medium text-slate-800 hover:text-ocean-800"
                >
                  {{ entry.task.title }}
                </NuxtLink>
                <p class="truncate text-xs text-slate-500">
                  <template v-if="entry.task.customers">{{ entry.task.customers.name }}</template>
                  <template v-if="entry.task.customers && entry.task.features"> · </template>
                  <template v-if="entry.task.features">{{ entry.task.features.name }}</template>
                  <template v-if="entry.task.customers || entry.task.features"> · </template>
                  {{ t(`status.${entry.task.status}`) }}
                </p>
              </div>
              <div v-if="member.user_id === user?.id" class="flex shrink-0">
                <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-arrow-up" :disabled="i === 0" :aria-label="t('features.moveUp')" @click="move(member.user_id, i, -1)" />
                <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-arrow-down" :disabled="i === total - 1" :aria-label="t('features.moveDown')" @click="move(member.user_id, i, 1)" />
                <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" :aria-label="t('focus.remove')" @click="unfocus(entry.task.id)" />
              </div>
            </div>
          </li>
        </ol>

        <UButton
          v-if="total > FOCUS_SOFT_LIMIT"
          size="xs"
          variant="link"
          color="neutral"
          class="mt-2"
          @click="toggleExpanded(member.user_id)"
        >
          {{ expanded.has(member.user_id) ? t("common.showLess") : t("focus.more", { n: total - FOCUS_SOFT_LIMIT }) }}
        </UButton>
      </section>
    </div>
  </div>
</template>
