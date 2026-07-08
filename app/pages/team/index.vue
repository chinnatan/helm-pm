<script setup lang="ts">
import { format } from "date-fns";

definePageMeta({ middleware: "auth" });

const { members, fetchWorkspace, inviteMember } = useWorkspace();
const { fetchProjects } = useProjects();
const supabase = useSupabaseClient();

const inviteEmail = ref("");
const inviteRole = ref("member");
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
    .select("assignee_id, status, due_date")
    .neq("status", "done");

  const counts: Record<string, number> = {};
  const overdue: Record<string, number> = {};
  const today = format(new Date(), "yyyy-MM-dd");

  for (const task of tasks ?? []) {
    if (!task.assignee_id) continue;
    counts[task.assignee_id] = (counts[task.assignee_id] ?? 0) + 1;
    if (task.due_date && task.due_date < today) {
      overdue[task.assignee_id] = (overdue[task.assignee_id] ?? 0) + 1;
    }
  }

  memberTasks.value = counts;
  memberOverdue.value = overdue;
}

async function handleInvite() {
  if (!inviteEmail.value.trim()) return;
  inviting.value = true;
  inviteError.value = "";

  const { error } = await inviteMember(inviteEmail.value.trim(), inviteRole.value);
  inviting.value = false;

  if (error) {
    inviteError.value = error;
  } else {
    inviteEmail.value = "";
    await fetchWorkload();
  }
}

const roleOptions = [
  { label: "Member", value: "member" },
  { label: "Manager", value: "manager" },
  { label: "Viewer", value: "viewer" },
  { label: "Admin", value: "admin" },
];
</script>

<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Team</h1>
        <p class="text-sm text-slate-500">Workspace members and workload</p>
      </div>
      <LayoutNotificationBell />
    </div>

    <div class="mb-8 rounded-xl border border-slate-200 bg-white p-5">
      <h2 class="mb-4 text-sm font-semibold text-slate-700">Invite Member</h2>
      <UAlert v-if="inviteError" color="error" variant="subtle" class="mb-3" :title="inviteError" />
      <div class="flex flex-wrap gap-3">
        <UInput v-model="inviteEmail" placeholder="email@example.com" class="w-64" />
        <USelect v-model="inviteRole" :items="roleOptions" class="w-36" />
        <UButton :loading="inviting" @click="handleInvite">Invite</UButton>
      </div>
      <p class="mt-2 text-xs text-slate-400">User must sign up first before they can be invited</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="member in members"
        :key="member.id"
        class="rounded-xl border border-slate-200 bg-white p-5"
      >
        <div class="mb-3 flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-600">
            {{ (member.profiles?.full_name || member.profiles?.email)?.[0]?.toUpperCase() }}
          </div>
          <div>
            <p class="font-medium text-slate-900">
              {{ member.profiles?.full_name || member.profiles?.email }}
            </p>
            <p class="text-xs capitalize text-slate-500">{{ member.role }}</p>
          </div>
        </div>
        <div class="flex gap-4 text-sm">
          <div>
            <p class="text-slate-500">Active tasks</p>
            <p class="text-lg font-semibold">{{ memberTasks[member.user_id] ?? 0 }}</p>
          </div>
          <div>
            <p class="text-slate-500">Overdue</p>
            <p class="text-lg font-semibold text-red-500">{{ memberOverdue[member.user_id] ?? 0 }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
