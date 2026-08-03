<script setup lang="ts">
import type { InviteType, JobRole, MemberRole } from "~/types";
import { DEFAULT_WEEKLY_CAPACITY_HOURS, JOB_ROLE_VALUES } from "~/types";
import { addDays, format, parseISO } from "date-fns";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const {
  workspace,
  members,
  fetchWorkspace,
  updateMember,
  canManageMembers,
  isWorkspaceAdmin,
} = useWorkspace();
const { projects, fetchProjects } = useProjects();
const {
  invites,
  fetchInvites,
  createInvite,
  revokeInvite,
  inviteUrl,
} = useWorkspaceInvites();
const {
  loading: capacityLoading,
  fetchCapacityData,
  memberRows,
  workspaceSummary,
  forwardWeekBuckets,
  burnWeekBuckets,
  avgWeeklyBurn,
  runwayWeeks,
  memberCapacity,
} = useTeamCapacity();
const { scheduleCapacityAlerts } = useCapacityAlerts();

function baselineWeeklyFor(userId: string) {
  return memberCapacity(userId) || DEFAULT_WEEKLY_CAPACITY_HOURS;
}

const activeTab = ref<"members" | "capacity">("capacity");

const linkType = ref<InviteType>("open");
const linkEmail = ref("");
const linkRole = ref<MemberRole>("member");
const linkJobRole = ref<JobRole | null>(null);
const linkMaxUses = ref(1);
const expiryPreset = ref<"1" | "7" | "30" | "custom">("7");
const customExpiry = ref("");
const creatingLink = ref(false);
const linkError = ref("");
const lastCreatedUrl = ref<string | null>(null);
const copied = ref(false);

watch(linkType, (type) => {
  if (type === "email") linkMaxUses.value = 1;
});

async function refreshCapacity() {
  await fetchCapacityData();
  scheduleCapacityAlerts({ projects: projects.value });
}

onMounted(async () => {
  await fetchWorkspace();
  await fetchProjects();
  await refreshCapacity();
  if (isWorkspaceAdmin.value) await fetchInvites();
});

watch(
  () => workspace.value?.id,
  async (id, prev) => {
    if (id && prev && id !== prev) {
      await fetchProjects();
      await refreshCapacity();
      if (isWorkspaceAdmin.value) await fetchInvites();
    }
  },
);

watch(isWorkspaceAdmin, async (admin) => {
  if (admin) await fetchInvites();
});

function rowFor(userId: string) {
  return memberRows.value.find((r) => r.userId === userId);
}

function resolveExpiresAt(): string | null {
  if (expiryPreset.value === "custom") {
    if (!customExpiry.value) return null;
    const d = new Date(customExpiry.value);
    if (Number.isNaN(d.getTime()) || d <= new Date()) return null;
    return d.toISOString();
  }
  const days = Number(expiryPreset.value);
  return addDays(new Date(), days).toISOString();
}

async function handleCreateLink() {
  if (!isWorkspaceAdmin.value) return;
  creatingLink.value = true;
  linkError.value = "";
  lastCreatedUrl.value = null;

  const expiresAt = resolveExpiresAt();
  if (!expiresAt) {
    linkError.value = t("team.expiresCustom");
    creatingLink.value = false;
    return;
  }

  if (linkType.value === "email" && !linkEmail.value.trim()) {
    linkError.value = t("team.email");
    creatingLink.value = false;
    return;
  }

  const maxUses =
    linkType.value === "email"
      ? 1
      : Math.min(500, Math.max(1, Math.floor(Number(linkMaxUses.value) || 1)));

  const { data, error } = await createInvite({
    inviteType: linkType.value,
    expiresAt,
    role: linkRole.value,
    jobRole: linkJobRole.value,
    email: linkType.value === "email" ? linkEmail.value.trim() : null,
    maxUses,
  });

  creatingLink.value = false;

  if (error || !data) {
    linkError.value = error ?? "Failed";
    return;
  }

  lastCreatedUrl.value = data.url;
  linkEmail.value = "";
}

async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    /* ignore */
  }
}

async function handleRevoke(id: string) {
  await revokeInvite(id);
}

async function handleJobRoleChange(memberId: string, jobRole: unknown) {
  const value =
    jobRole === "developer" ||
    jobRole === "tester" ||
    jobRole === "designer" ||
    jobRole === "pm" ||
    jobRole === "other"
      ? jobRole
      : null;
  await updateMember(memberId, { job_role: value });
}

async function handlePermissionRoleChange(memberId: string, role: unknown) {
  if (
    role !== "admin" &&
    role !== "manager" &&
    role !== "member" &&
    role !== "viewer"
  ) {
    return;
  }
  await updateMember(memberId, { role });
}

async function handleCapacityChange(memberId: string, raw: unknown) {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 8 || n > 60) return;
  const current = members.value.find((m) => m.id === memberId)?.weekly_capacity_hours;
  if (current != null && Number(current) === n) return;
  await updateMember(memberId, { weekly_capacity_hours: n });
  await refreshCapacity();
}

function inviteStatus(inv: {
  revoked_at: string | null;
  accepted_at: string | null;
  expires_at: string;
  max_uses?: number;
  uses_count?: number;
}) {
  if (inv.revoked_at) return "revoked";
  const maxUses = inv.max_uses ?? 1;
  const uses = inv.uses_count ?? 0;
  if (uses >= maxUses || inv.accepted_at) return "accepted";
  if (parseISO(inv.expires_at) <= new Date()) return "expired";
  return "valid";
}

function inviteStatusLabel(status: string) {
  if (status === "valid") return t("team.linkValid");
  if (status === "expired") return t("team.linkExpired");
  if (status === "revoked") return t("team.linkRevoked");
  if (status === "accepted") return t("team.linkAccepted");
  return status;
}

function inviteUsesLabel(inv: { max_uses?: number; uses_count?: number }) {
  const maxUses = inv.max_uses ?? 1;
  const uses = inv.uses_count ?? 0;
  return t("team.usesCount", { used: uses, max: maxUses });
}

function formatWhen(iso: string) {
  try {
    return format(parseISO(iso), "dd MMM yyyy HH:mm");
  } catch {
    return iso;
  }
}

const roleOptions = computed(() => [
  { label: t("team.roles.member"), value: "member" },
  { label: t("team.roles.manager"), value: "manager" },
  { label: t("team.roles.viewer"), value: "viewer" },
  { label: t("team.roles.admin"), value: "admin" },
]);

const jobRoleOptions = computed(() => [
  { label: t("team.jobRoleNone"), value: null },
  ...JOB_ROLE_VALUES.map((value) => ({
    label: t(`team.jobRoles.${value}`),
    value,
  })),
]);

const typeOptions = computed(() => [
  { label: t("team.inviteTypeOpen"), value: "open" },
  { label: t("team.inviteTypeEmail"), value: "email" },
]);

const expiryOptions = computed(() => [
  { label: t("team.expires1d"), value: "1" },
  { label: t("team.expires7d"), value: "7" },
  { label: t("team.expires30d"), value: "30" },
  { label: t("team.expiresCustom"), value: "custom" },
]);

const listedInvites = computed(() => invites.value);

const tabItems = computed(() => [
  { label: t("team.tabCapacity"), value: "capacity" as const },
  { label: t("team.tabMembers"), value: "members" as const },
]);
</script>

<template>
  <div class="p-4 md:p-6">
    <div class="mb-6">
      <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">{{ t("team.title") }}</h1>
      <p class="text-sm text-slate-500">
        {{ t("team.subtitle") }}
        <span v-if="workspace" class="text-slate-400"> · {{ workspace.name }}</span>
      </p>
    </div>

    <div class="mb-6 flex gap-2 border-b border-slate-200 pb-2">
      <UButton
        v-for="tab in tabItems"
        :key="tab.value"
        :variant="activeTab === tab.value ? 'solid' : 'ghost'"
        color="neutral"
        size="sm"
        @click="activeTab = tab.value"
      >
        {{ tab.label }}
      </UButton>
    </div>

    <template v-if="activeTab === 'capacity'">
      <p class="mb-4 max-w-3xl text-sm text-slate-500">{{ t("capacity.hint") }}</p>

      <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-4">
          <p class="text-sm text-slate-500">{{ t("capacity.remainingHours") }}</p>
          <p class="text-2xl font-bold text-slate-900">
            {{ workspaceSummary.remainingHours }}
            <span class="text-sm font-normal text-slate-400">{{ t("capacity.hoursUnit") }}</span>
          </p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4">
          <p class="text-sm text-slate-500">{{ t("capacity.activeTasks") }}</p>
          <p class="text-2xl font-bold text-slate-900">{{ workspaceSummary.activeTaskCount }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4">
          <p class="text-sm text-slate-500">{{ t("capacity.teamThisWeek") }}</p>
          <p class="text-2xl font-bold text-slate-900">{{ workspaceSummary.thisWeekPct }}%</p>
          <p class="mt-0.5 text-xs text-slate-400">
            {{ workspaceSummary.thisWeekHours }} / {{ workspaceSummary.teamCapacity }}
            {{ t("capacity.hoursUnit") }}
          </p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4">
          <p class="text-sm text-slate-500">{{ t("capacity.overdue") }}</p>
          <p class="text-2xl font-bold text-red-500">{{ workspaceSummary.overdueCount }}</p>
        </div>
      </div>

      <div class="mb-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <p class="text-sm text-slate-500">{{ t("capacity.avgBurn") }}</p>
        <p class="text-xl font-semibold text-slate-900">
          {{ avgWeeklyBurn }}
          <span class="text-sm font-normal text-slate-400">{{ t("capacity.hoursUnit") }}</span>
        </p>
        <p v-if="runwayWeeks != null" class="mt-2 text-sm font-medium text-ocean-800">
          {{ t("capacity.runway", { weeks: runwayWeeks }) }}
        </p>
        <p v-else class="mt-2 text-sm text-slate-400">{{ t("capacity.runwayUnknown") }}</p>
        <p class="mt-1 text-xs text-slate-400">{{ t("capacity.runwayHint") }}</p>
      </div>

      <div class="mb-6 grid gap-4 lg:grid-cols-2">
        <CapacityWeekChart
          :title="t('capacity.weeklyLoad')"
          :planned-label="t('capacity.thisWeek')"
          :burn-label="t('capacity.burn')"
          :buckets="forwardWeekBuckets"
          mode="forward"
        />
        <CapacityWeekChart
          :title="t('capacity.burnTitle')"
          :planned-label="t('capacity.intake')"
          :burn-label="t('capacity.burn')"
          :buckets="burnWeekBuckets"
          mode="burn"
        >
          <template #hint>
            <p class="text-xs text-slate-400">{{ t("capacity.burnHint") }}</p>
          </template>
        </CapacityWeekChart>
      </div>

      <div class="mb-6">
        <CapacityMonthSpreadsheet @saved="refreshCapacity" />
      </div>

      <div v-if="capacityLoading" class="text-sm text-slate-400">{{ t("common.loading") }}</div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="row in memberRows"
          :key="row.userId"
          class="rounded-xl border border-slate-200 bg-white p-5"
        >
          <div class="mb-3 flex items-center gap-3">
            <UserAvatar size="md" :name="row.name" />
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-slate-900">{{ row.name }}</p>
              <p class="text-xs text-slate-400">
                {{ row.activeTaskCount }} {{ t("capacity.activeTasks").toLowerCase() }}
                · {{ row.overdueCount }} {{ t("capacity.overdue").toLowerCase() }}
              </p>
            </div>
          </div>

          <UFormField
            v-if="canManageMembers"
            :label="t('capacity.weeklyCapacity')"
            :hint="t('capacity.weeklyCapacityHint')"
            class="mb-3"
          >
            <UInput
              type="number"
              min="8"
              max="60"
              step="1"
              :model-value="baselineWeeklyFor(row.userId)"
              class="w-full"
              @update:model-value="(v) => handleCapacityChange(row.membershipId, v)"
            />
          </UFormField>
          <p v-else class="mb-3 text-sm text-slate-500">
            {{ t("capacity.weeklyCapacity") }}:
            <span class="font-medium text-slate-800">
              {{ baselineWeeklyFor(row.userId) }}
            </span>
            {{ t("capacity.hoursUnit") }}
          </p>
          <p class="mb-3 text-xs text-slate-400">
            {{ t("capacity.thisWeekCap") }}:
            <span class="font-medium text-slate-700">
              {{ row.capacityHours }}{{ t("capacity.hoursUnit") }}
            </span>
          </p>

          <div class="mb-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p class="text-slate-500">{{ t("capacity.remaining") }}</p>
              <p class="font-semibold">
                {{ row.remainingHours }} {{ t("capacity.hoursUnit") }}
              </p>
            </div>
            <div v-if="row.unplannedCount > 0">
              <p class="text-slate-500" :title="t('capacity.unplannedHint')">
                {{ t("capacity.unplanned") }}
              </p>
              <p class="font-semibold text-amber-600">{{ row.unplannedCount }}</p>
            </div>
          </div>

          <div class="space-y-3">
            <CapacityLoadBar
              :pct="row.thisWeekPct"
              :label="`${t('capacity.thisWeek')} · ${row.thisWeekHours}${t('capacity.hoursUnit')}`"
            />
            <CapacityLoadBar
              :pct="row.nextWeekPct"
              :label="`${t('capacity.nextWeek')} · ${row.nextWeekHours}${t('capacity.hoursUnit')}`"
            />
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <!-- Invite links (admin) -->
      <div
        v-if="isWorkspaceAdmin"
        class="mb-8 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
      >
        <h2 class="mb-1 text-sm font-semibold text-slate-700">{{ t("team.inviteLinkTitle") }}</h2>
        <p class="mb-4 text-xs text-slate-400">{{ t("team.inviteLinkHint") }}</p>

        <UAlert v-if="linkError" color="error" variant="subtle" class="mb-3" :title="linkError" />

        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <UFormField :label="t('team.inviteType')" class="w-full sm:w-40">
            <USelect v-model="linkType" :items="typeOptions" class="w-full" />
          </UFormField>
          <UFormField
            v-if="linkType === 'email'"
            :label="t('team.email')"
            class="w-full sm:w-56"
          >
            <UInput v-model="linkEmail" placeholder="email@example.com" class="w-full" />
          </UFormField>
          <UFormField :label="t('team.permissionRole')" class="w-full sm:w-36">
            <USelect v-model="linkRole" :items="roleOptions" class="w-full" />
          </UFormField>
          <UFormField :label="t('team.jobRole')" class="w-full sm:w-40">
            <USelect v-model="linkJobRole" :items="jobRoleOptions" class="w-full" />
          </UFormField>
          <UFormField
            v-if="linkType === 'open'"
            :label="t('team.maxUses')"
            :hint="t('team.maxUsesHint')"
            class="w-full sm:w-28"
          >
            <UInput
              v-model.number="linkMaxUses"
              type="number"
              :min="1"
              :max="500"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('team.expires')" class="w-full sm:w-40">
            <USelect v-model="expiryPreset" :items="expiryOptions" class="w-full" />
          </UFormField>
          <UFormField
            v-if="expiryPreset === 'custom'"
            :label="t('team.expiresCustom')"
            class="w-full sm:w-52"
          >
            <UInput v-model="customExpiry" type="datetime-local" class="w-full" />
          </UFormField>
          <UButton :loading="creatingLink" class="w-full sm:w-auto" @click="handleCreateLink">
            {{ t("team.createLink") }}
          </UButton>
        </div>

        <div
          v-if="lastCreatedUrl"
          class="mt-4 flex flex-col gap-2 rounded-lg bg-ocean-50 p-3 sm:flex-row sm:items-center"
        >
          <code class="min-w-0 flex-1 truncate text-xs text-ocean-900">{{ lastCreatedUrl }}</code>
          <UButton
            size="sm"
            variant="soft"
            @click="lastCreatedUrl && copyUrl(lastCreatedUrl)"
          >
            {{ copied ? t("team.copied") : t("team.copyLink") }}
          </UButton>
        </div>

        <h3 class="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {{ t("team.activeLinks") }}
        </h3>
        <div v-if="listedInvites.length === 0" class="text-sm text-slate-400">
          {{ t("team.noLinks") }}
        </div>
        <ul v-else class="divide-y divide-slate-100 rounded-lg border border-slate-100">
          <li
            v-for="inv in listedInvites"
            :key="inv.id"
            class="flex flex-col gap-2 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge
                  :color="inviteStatus(inv) === 'valid' ? 'success' : 'neutral'"
                  variant="subtle"
                  size="xs"
                >
                  {{ inviteStatusLabel(inviteStatus(inv)) }}
                </UBadge>
                <span class="text-slate-700">
                  {{ inv.invite_type === "email" ? inv.email : t("team.inviteTypeOpen") }}
                </span>
                <span class="text-slate-400">· {{ t(`team.roles.${inv.role}`) }}</span>
              </div>
              <p class="mt-0.5 text-xs text-slate-400">
                {{ inviteUsesLabel(inv) }}
                · {{ t("team.expires") }}: {{ formatWhen(inv.expires_at) }}
              </p>
            </div>
            <div class="flex shrink-0 gap-2">
              <UButton
                v-if="inviteStatus(inv) === 'valid'"
                size="xs"
                variant="ghost"
                @click="copyUrl(inviteUrl(inv.token))"
              >
                {{ t("team.copyLink") }}
              </UButton>
              <UButton
                v-if="inviteStatus(inv) === 'valid'"
                size="xs"
                color="error"
                variant="ghost"
                @click="handleRevoke(inv.id)"
              >
                {{ t("team.revoke") }}
              </UButton>
            </div>
          </li>
        </ul>
      </div>
      <p v-else class="mb-6 text-sm text-slate-400">{{ t("team.adminsOnly") }}</p>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="member in members"
          :key="member.id"
          class="rounded-xl border border-slate-200 bg-white p-5"
        >
          <div class="mb-3 flex items-center gap-3">
            <UserAvatar
              size="md"
              :src="member.profiles?.avatar_url"
              :name="member.profiles?.full_name"
              :email="member.profiles?.email"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-slate-900">
                {{ member.profiles?.full_name || member.profiles?.email }}
              </p>
              <div class="mt-1 flex flex-wrap gap-1.5">
                <UBadge color="neutral" variant="subtle" size="xs">
                  {{ t(`team.roles.${member.role}`) }}
                </UBadge>
                <UBadge
                  v-if="member.job_role"
                  color="info"
                  variant="subtle"
                  size="xs"
                >
                  {{ t(`team.jobRoles.${member.job_role}`) }}
                </UBadge>
                <UBadge v-else color="neutral" variant="outline" size="xs">
                  {{ t("team.jobRoleNone") }}
                </UBadge>
              </div>
            </div>
          </div>

          <div
            v-if="isWorkspaceAdmin"
            class="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <UFormField :label="t('team.permissionRole')">
              <USelect
                :model-value="member.role"
                :items="roleOptions"
                class="w-full"
                @update:model-value="(v) => handlePermissionRoleChange(member.id, v)"
              />
            </UFormField>
            <UFormField :label="t('team.jobRole')">
              <USelect
                :model-value="member.job_role"
                :items="jobRoleOptions"
                class="w-full"
                @update:model-value="(v) => handleJobRoleChange(member.id, v)"
              />
            </UFormField>
          </div>
          <UFormField
            v-else-if="canManageMembers"
            :label="t('team.jobRole')"
            class="mb-3"
          >
            <USelect
              :model-value="member.job_role"
              :items="jobRoleOptions"
              class="w-full"
              @update:model-value="(v) => handleJobRoleChange(member.id, v)"
            />
          </UFormField>

          <div class="flex gap-4 text-sm">
            <div>
              <p class="text-slate-500">{{ t("team.activeTasks") }}</p>
              <p class="text-lg font-semibold">
                {{ rowFor(member.user_id)?.activeTaskCount ?? 0 }}
              </p>
            </div>
            <div>
              <p class="text-slate-500">{{ t("team.overdue") }}</p>
              <p class="text-lg font-semibold text-red-500">
                {{ rowFor(member.user_id)?.overdueCount ?? 0 }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
