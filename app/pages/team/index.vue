<script setup lang="ts">
import type { JobRole } from "~/types";
import { JOB_ROLE_VALUES } from "~/types";
import { format } from "date-fns";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const {
  members,
  fetchWorkspace,
  inviteMember,
  updateMember,
  canManageMembers,
} = useWorkspace();
const { fetchProjects } = useProjects();
const supabase = useSupabaseClient();

const inviteEmail = ref("");
const inviteRole = ref("member");
const inviteJobRole = ref<JobRole | null>(null);
const inviting = ref(false);
const inviteError = ref("");

const memberTasks = ref<Record<string, number>>({});
const memberOverdue = ref<Record<string, number>>({});

onMounted(async () => {
  await fetchWorkspace();
  await fetchProjects();
  await fetchWorkload();
});

async function fetchWorkload() {
  const { data: tasks } = await supabase
    .from("tasks")
    .select("assignee_id, tester_id, status, due_date")
    .not("status", "in", "(done,release,cancelled)");

  const counts: Record<string, number> = {};
  const overdue: Record<string, number> = {};
  const today = format(new Date(), "yyyy-MM-dd");

  for (const task of tasks ?? []) {
    const ids = [task.assignee_id, task.tester_id].filter(Boolean) as string[];
    const unique = [...new Set(ids)];
    for (const id of unique) {
      counts[id] = (counts[id] ?? 0) + 1;
      if (task.due_date && task.due_date < today) {
        overdue[id] = (overdue[id] ?? 0) + 1;
      }
    }
  }

  memberTasks.value = counts;
  memberOverdue.value = overdue;
}

async function handleInvite() {
  if (!inviteEmail.value.trim()) return;
  inviting.value = true;
  inviteError.value = "";

  const { error } = await inviteMember(
    inviteEmail.value.trim(),
    inviteRole.value,
    inviteJobRole.value,
  );
  inviting.value = false;

  if (error) {
    inviteError.value = error;
  } else {
    inviteEmail.value = "";
    inviteJobRole.value = null;
    await fetchWorkload();
  }
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
</script>

<template>
  <div class="p-4 md:p-6">
    <div class="mb-6">
      <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">{{ t("team.title") }}</h1>
      <p class="text-sm text-slate-500">{{ t("team.subtitle") }}</p>
    </div>

    <div class="mb-8 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 class="mb-4 text-sm font-semibold text-slate-700">{{ t("team.inviteMember") }}</h2>
      <UAlert v-if="inviteError" color="error" variant="subtle" class="mb-3" :title="inviteError" />
      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <UFormField :label="t('team.email')" class="w-full sm:w-64">
          <UInput v-model="inviteEmail" placeholder="email@example.com" class="w-full" />
        </UFormField>
        <UFormField :label="t('team.permissionRole')" class="w-full sm:w-36">
          <USelect v-model="inviteRole" :items="roleOptions" class="w-full" />
        </UFormField>
        <UFormField :label="t('team.jobRole')" class="w-full sm:w-40">
          <USelect v-model="inviteJobRole" :items="jobRoleOptions" class="w-full" />
        </UFormField>
        <UButton :loading="inviting" class="w-full sm:w-auto" @click="handleInvite">
          {{ t("team.invite") }}
        </UButton>
      </div>
      <p class="mt-2 text-xs text-slate-400">{{ t("team.inviteHint") }}</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="member in members"
        :key="member.id"
        class="rounded-xl border border-slate-200 bg-white p-5"
      >
        <div class="mb-3 flex items-center gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-600">
            {{ (member.profiles?.full_name || member.profiles?.email)?.[0]?.toUpperCase() }}
          </div>
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

        <UFormField
          v-if="canManageMembers"
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
            <p class="text-lg font-semibold">{{ memberTasks[member.user_id] ?? 0 }}</p>
          </div>
          <div>
            <p class="text-slate-500">{{ t("team.overdue") }}</p>
            <p class="text-lg font-semibold text-red-500">{{ memberOverdue[member.user_id] ?? 0 }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
