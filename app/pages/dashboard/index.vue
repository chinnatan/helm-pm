<script setup lang="ts">
import type { Milestone, Task, TaskPhase, TaskStatus } from "~/types";
import { isTaskClosed, taskPhaseMeta, TASK_PHASE_VALUES } from "~/types";
import { addDays, format } from "date-fns";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const supabase = useSupabaseClient();
const { dateFnsLocale } = useDateLocale();
const { statuses, statusLabel, priorityLabel } = useTaskLabels();
const { workspace, fetchWorkspace, members } = useWorkspace();
const { customers, fetchCustomers } = useCustomers();
const { fetchCapacityData, memberRows } = useTeamCapacity();

interface DashTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Task["priority"];
  phase: TaskPhase | null;
  due_date: string | null;
  start_date: string | null;
  assignee_id: string | null;
  customer_id: string | null;
  project_id: string;
  profiles?: Task["profiles"];
  projects?: { id: string; name: string; color: string; customer_id: string | null } | null;
  subtasks?: Task["subtasks"];
}

interface DashMilestone extends Pick<Milestone, "id" | "title" | "due_date" | "date" | "status"> {
  projects?: { id: string; name: string } | null;
}

const loading = ref(true);
const allTasks = ref<DashTask[]>([]);
const allMilestones = ref<DashMilestone[]>([]);

const showModal = ref(false);
const selectedTask = ref<Task | null>(null);

const todayStr = format(new Date(), "yyyy-MM-dd");
const soonStr = format(addDays(new Date(), 7), "yyyy-MM-dd");
const monthStr = format(addDays(new Date(), 30), "yyyy-MM-dd");

const TASK_SELECT = `
  *,
  profiles:assignee_id(id, email, full_name, avatar_url),
  projects!inner(id, name, color, customer_id, workspace_id),
  subtasks(*)
`;

async function load() {
  if (!workspace.value) return;
  loading.value = true;
  const wsId = workspace.value.id;

  const [tasksRes, msRes] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_SELECT)
      .eq("projects.workspace_id", wsId)
      .order("due_date", { ascending: true }),
    supabase
      .from("milestones")
      .select("id, title, date, due_date, status, projects!inner(id, name, workspace_id)")
      .eq("projects.workspace_id", wsId)
      .not("status", "in", "(done,cancelled)")
      .order("due_date", { ascending: true }),
  ]);

  allTasks.value = (tasksRes.data ?? []) as unknown as DashTask[];
  allMilestones.value = (msRes.data ?? []) as unknown as DashMilestone[];
  loading.value = false;
}

onMounted(async () => {
  await fetchWorkspace();
  await Promise.all([fetchCustomers(), load(), fetchCapacityData()]);
});

const customerNameById = computed(
  () => new Map(customers.value.map((c) => [c.id, c.name])),
);

function taskCustomerId(task: DashTask) {
  return task.customer_id ?? task.projects?.customer_id ?? null;
}

const customerStats = computed(() => {
  const stats = new Map<
    string,
    { total: number; done: number; overdue: number; open: number }
  >();
  for (const c of customers.value) {
    stats.set(c.id, { total: 0, done: 0, overdue: 0, open: 0 });
  }
  for (const task of allTasks.value) {
    const cid = taskCustomerId(task);
    if (!cid) continue;
    const s = stats.get(cid);
    if (!s) continue;
    if (task.status === "cancelled") continue;
    s.total += 1;
    if (task.status === "done" || task.status === "release") s.done += 1;
    else if (!isTaskClosed(task.status)) {
      s.open += 1;
      if (task.due_date && task.due_date < todayStr) s.overdue += 1;
    }
  }
  return stats;
});

const activeCustomers = computed(() =>
  customers.value.filter((c) => c.status === "active"),
);

const overdueTasks = computed(() =>
  allTasks.value.filter(
    (task) =>
      !isTaskClosed(task.status) &&
      task.due_date != null &&
      task.due_date < todayStr,
  ),
);

const atRiskTasks = computed(() =>
  allTasks.value.filter(
    (task) =>
      !isTaskClosed(task.status) &&
      (task.status === "backlog" || task.status === "todo") &&
      task.due_date != null &&
      task.due_date >= todayStr &&
      task.due_date <= soonStr,
  ),
);

const riskTasks = computed(() =>
  [...overdueTasks.value, ...atRiskTasks.value].slice(0, 12),
);

const upcomingMilestones = computed(() =>
  allMilestones.value
    .filter((m) => {
      const due = m.due_date || m.date;
      return due && due >= todayStr && due <= monthStr;
    })
    .slice(0, 8),
);

const workloadRows = computed(() =>
  [...memberRows.value]
    .filter((r) => r.activeTaskCount > 0)
    .sort((a, b) => b.thisWeekPct - a.thisWeekPct)
    .slice(0, 8),
);

/* ---------- all tasks view ---------- */

const filter = reactive({
  customer: "all",
  project: "all",
  phase: "all",
  status: "all",
  priority: "all",
  assignee: "all",
  group: "none" as "none" | "customer" | "project" | "phase" | "status",
});

const projectOptions = computed(() => {
  const map = new Map<string, string>();
  for (const task of allTasks.value) {
    if (task.projects) map.set(task.projects.id, task.projects.name);
  }
  return [...map.entries()].map(([value, label]) => ({ value, label }));
});

const customerFilterItems = computed(() => [
  { label: t("dashboard.allCustomers"), value: "all" },
  ...customers.value.map((c) => ({ label: c.name, value: c.id })),
]);

const projectFilterItems = computed(() => [
  { label: t("dashboard.allProjects"), value: "all" },
  ...projectOptions.value,
]);

const phaseFilterItems = computed(() => [
  { label: t("dashboard.allPhases"), value: "all" },
  ...TASK_PHASE_VALUES.map((p) => ({
    label: t(`tasks.phase.${p.value}`),
    value: p.value,
  })),
]);

const statusFilterItems = computed(() => [
  { label: t("projects.allStatus"), value: "all" },
  ...statuses.value.map((s) => ({ label: s.label, value: s.value })),
]);

const priorityFilterItems = computed(() => [
  { label: t("projects.allPriority"), value: "all" },
  ...(["low", "medium", "high", "urgent"] as const).map((p) => ({
    label: priorityLabel(p),
    value: p,
  })),
]);

const assigneeFilterItems = computed(() => [
  { label: t("projects.allAssignees"), value: "all" },
  ...members.value.map((m) => ({
    label: m.profiles?.full_name || m.profiles?.email || "",
    value: m.user_id,
  })),
]);

const groupItems = computed(() => [
  { label: t("dashboard.groupNone"), value: "none" },
  { label: t("dashboard.groupCustomer"), value: "customer" },
  { label: t("dashboard.groupProject"), value: "project" },
  { label: t("dashboard.groupPhase"), value: "phase" },
  { label: t("dashboard.groupStatus"), value: "status" },
]);

function groupKey(task: DashTask): { key: string; label: string } {
  switch (filter.group) {
    case "customer": {
      const cid = taskCustomerId(task);
      return { key: cid ?? "", label: cid ? customerNameById.value.get(cid) ?? cid : t("dashboard.unassignedCustomer") };
    }
    case "project":
      return { key: task.project_id, label: task.projects?.name ?? "—" };
    case "phase":
      return {
        key: task.phase ?? "",
        label: task.phase ? t(`tasks.phase.${task.phase}`) : t("projects.ganttNoPhase"),
      };
    case "status":
      return { key: task.status, label: statusLabel(task.status) };
    default:
      return { key: "", label: "" };
  }
}

const filteredTasks = computed(() =>
  allTasks.value.filter((task) => {
    if (filter.customer !== "all" && taskCustomerId(task) !== filter.customer) return false;
    if (filter.project !== "all" && task.project_id !== filter.project) return false;
    if (filter.phase !== "all" && (task.phase ?? "") !== filter.phase) return false;
    if (filter.status !== "all" && task.status !== filter.status) return false;
    if (filter.priority !== "all" && task.priority !== filter.priority) return false;
    if (filter.assignee !== "all" && task.assignee_id !== filter.assignee) return false;
    return true;
  }),
);

// ponytail: renders every filtered row; cap the DOM if a workspace ever grows past a few thousand tasks.
const groupedTasks = computed(() => {
  if (filter.group === "none") {
    return [{ key: "", label: "", items: filteredTasks.value }];
  }
  const order: { key: string; label: string; items: DashTask[] }[] = [];
  const byKey = new Map<string, { key: string; label: string; items: DashTask[] }>();
  for (const task of filteredTasks.value) {
    const { key, label } = groupKey(task);
    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = { key, label, items: [] };
      byKey.set(key, bucket);
      order.push(bucket);
    }
    bucket.items.push(task);
  }
  return order;
});

function formatDue(date: string) {
  try {
    return format(new Date(date), "d MMM yyyy", { locale: dateFnsLocale.value });
  } catch {
    return date;
  }
}

function personName(task: DashTask) {
  return task.profiles?.full_name || task.profiles?.email || t("common.emDash");
}

function customerLabel(task: DashTask) {
  const cid = taskCustomerId(task);
  return cid ? customerNameById.value.get(cid) ?? cid : t("common.emDash");
}

function openTask(task: Task) {
  selectedTask.value = task;
  showModal.value = true;
}

function phaseStyle(phase: TaskPhase | null) {
  const meta = taskPhaseMeta(phase ?? undefined);
  if (!meta) return null;
  return { color: meta.color, borderColor: meta.color };
}

async function onSaved() {
  await load();
}
</script>

<template>
  <div class="p-4 md:p-6">
    <div class="mb-6">
      <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">{{ t("dashboard.title") }}</h1>
      <p class="text-sm text-slate-500">{{ t("dashboard.subtitle") }}</p>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-slate-400" />
    </div>

    <template v-else>
      <!-- Customer progress -->
      <section class="mb-8">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {{ t("dashboard.customerProgress") }}
        </h2>
        <p v-if="activeCustomers.length === 0" class="text-sm text-slate-400">
          {{ t("dashboard.noCustomers") }}
        </p>
        <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NuxtLink
            v-for="customer in activeCustomers"
            :key="customer.id"
            :to="`/customers/${customer.id}`"
            class="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <h3 class="mb-2 truncate font-semibold text-slate-900 group-hover:text-ocean-800">
              {{ customer.name }}
            </h3>
            <div class="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span>{{ t("dashboard.progress") }}</span>
              <span>{{ customerStats.get(customer.id)?.done ?? 0 }}/{{ customerStats.get(customer.id)?.total ?? 0 }}</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full bg-emerald-500 transition-all"
                :style="{
                  width: `${(customerStats.get(customer.id)?.total ?? 0) > 0 ? Math.round(((customerStats.get(customer.id)?.done ?? 0) / (customerStats.get(customer.id)?.total ?? 1)) * 100) : 0}%`,
                }"
              />
            </div>
            <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span class="text-slate-500">
                {{ t("dashboard.openShort") }}:
                <span class="font-medium text-slate-800">{{ customerStats.get(customer.id)?.open ?? 0 }}</span>
              </span>
              <span
                class="text-slate-500"
                :class="(customerStats.get(customer.id)?.overdue ?? 0) > 0 ? 'text-red-600' : ''"
              >
                {{ t("dashboard.overdueShort") }}:
                <span class="font-medium">{{ customerStats.get(customer.id)?.overdue ?? 0 }}</span>
              </span>
            </div>
          </NuxtLink>
        </div>
      </section>

      <div class="mb-8 grid gap-6 lg:grid-cols-2">
        <!-- Overdue & at risk -->
        <section class="rounded-xl border border-slate-200 bg-white p-5">
          <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <UIcon name="i-lucide-triangle-alert" class="h-4 w-4 text-red-500" />
            {{ t("dashboard.overdueAtRisk") }}
          </h2>
          <p v-if="riskTasks.length === 0" class="text-sm text-slate-400">
            {{ t("dashboard.noRisks") }}
          </p>
          <ul v-else class="space-y-1">
            <li
              v-for="task in riskTasks"
              :key="task.id"
              class="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-ocean-50"
              @click="openTask(task as unknown as Task)"
            >
              <div class="min-w-0">
                <p class="truncate text-sm text-slate-800">{{ task.title }}</p>
                <p class="truncate text-[11px] text-slate-400">
                  {{ customerLabel(task) }} · {{ task.projects?.name ?? "—" }}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-2 text-xs">
                <UBadge
                  :color="overdueTasks.some((x) => x.id === task.id) ? 'error' : 'warning'"
                  variant="subtle"
                  size="sm"
                >
                  {{ overdueTasks.some((x) => x.id === task.id) ? t("dashboard.overdueTag") : t("dashboard.atRiskTag") }}
                </UBadge>
                <span class="text-slate-500">{{ task.due_date ? formatDue(task.due_date) : "" }}</span>
              </div>
            </li>
          </ul>
        </section>

        <div class="space-y-6">
          <!-- Upcoming milestones -->
          <section class="rounded-xl border border-slate-200 bg-white p-5">
            <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <UIcon name="i-lucide-flag" class="h-4 w-4 text-ocean-700" />
              {{ t("dashboard.upcomingMilestones") }}
            </h2>
            <p v-if="upcomingMilestones.length === 0" class="text-sm text-slate-400">
              {{ t("dashboard.noMilestones") }}
            </p>
            <ul v-else class="space-y-1">
              <li v-for="ms in upcomingMilestones" :key="ms.id">
                <NuxtLink
                  v-if="ms.projects?.id"
                  :to="`/projects/${ms.projects.id}/gantt`"
                  class="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-ocean-50"
                >
                  <span class="truncate text-sm text-slate-800">{{ ms.title }}</span>
                  <span class="shrink-0 text-xs text-slate-500">
                    {{ ms.projects.name }} · {{ formatDue(ms.due_date || ms.date) }}
                  </span>
                </NuxtLink>
              </li>
            </ul>
          </section>

          <!-- Team workload -->
          <section class="rounded-xl border border-slate-200 bg-white p-5">
            <div class="mb-3 flex items-center justify-between">
              <h2 class="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <UIcon name="i-lucide-users" class="h-4 w-4 text-ocean-700" />
                {{ t("dashboard.teamWorkload") }}
              </h2>
              <NuxtLink to="/team" class="text-xs text-ocean-700 hover:underline">
                {{ t("nav.team") }}
              </NuxtLink>
            </div>
            <p v-if="workloadRows.length === 0" class="text-sm text-slate-400">
              {{ t("dashboard.noWorkload") }}
            </p>
            <div v-else class="space-y-3">
              <div v-for="row in workloadRows" :key="row.userId">
                <CapacityLoadBar
                  :pct="row.thisWeekPct"
                  :label="`${row.name} · ${row.thisWeekHours}/${row.capacityHours}h`"
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <!-- All tasks across clients -->
      <section class="rounded-xl border border-slate-200 bg-white p-5">
        <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <UIcon name="i-lucide-list" class="h-4 w-4 text-ocean-700" />
          {{ t("dashboard.allTasks") }}
          <span class="text-xs font-normal text-slate-400">({{ filteredTasks.length }})</span>
        </h2>

        <div class="mb-4 flex flex-wrap gap-2">
          <USelect v-model="filter.customer" :items="customerFilterItems" size="sm" class="w-40" />
          <USelect v-model="filter.project" :items="projectFilterItems" size="sm" class="w-40" />
          <USelect v-model="filter.phase" :items="phaseFilterItems" size="sm" class="w-32" />
          <USelect v-model="filter.status" :items="statusFilterItems" size="sm" class="w-36" />
          <USelect v-model="filter.priority" :items="priorityFilterItems" size="sm" class="w-32" />
          <USelect v-model="filter.assignee" :items="assigneeFilterItems" size="sm" class="w-40" />
          <span class="flex items-center text-xs font-medium text-slate-500">{{ t("dashboard.groupBy") }}</span>
          <USelect v-model="filter.group" :items="groupItems" size="sm" class="w-40" />
        </div>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[720px] text-sm">
            <thead class="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-3 py-2">{{ t("projects.colTitle") }}</th>
                <th class="px-3 py-2">{{ t("customers.title") }}</th>
                <th class="px-3 py-2">{{ t("projects.colStatus") }}</th>
                <th class="px-3 py-2">{{ t("projects.colPriority") }}</th>
                <th class="px-3 py-2">{{ t("projects.colAssignee") }}</th>
                <th class="px-3 py-2">{{ t("projects.colDueDate") }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="bucket in groupedTasks" :key="bucket.key || 'all'">
                <tr v-if="filter.group !== 'none'">
                  <td colspan="6" class="bg-ocean-50/60 px-3 py-1.5 text-xs font-semibold text-ocean-900">
                    {{ bucket.label || t("common.emDash") }}
                    <span class="font-normal text-slate-400">({{ bucket.items.length }})</span>
                  </td>
                </tr>
                <tr
                  v-for="task in bucket.items"
                  :key="task.id"
                  class="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                  @click="openTask(task as unknown as Task)"
                >
                  <td class="px-3 py-2">
                    <span class="text-slate-800">{{ task.title }}</span>
                    <span
                      v-if="task.phase"
                      class="ml-2 inline-block rounded-full border px-1.5 py-px text-[10px] align-middle"
                      :style="phaseStyle(task.phase) ?? undefined"
                    >
                      {{ t(`tasks.phase.${task.phase}`) }}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-slate-600">{{ customerLabel(task) }}</td>
                  <td class="px-3 py-2 text-slate-600">{{ statusLabel(task.status) }}</td>
                  <td class="px-3 py-2 text-slate-600">{{ priorityLabel(task.priority) }}</td>
                  <td class="px-3 py-2 text-slate-600">{{ personName(task) }}</td>
                  <td class="px-3 py-2 text-slate-600">
                    {{ task.due_date ? formatDue(task.due_date) : t("common.emDash") }}
                  </td>
                </tr>
              </template>
              <tr v-if="filteredTasks.length === 0">
                <td colspan="6" class="px-3 py-8 text-center text-slate-400">
                  {{ t("projects.noTasksFound") }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <TasksTaskModal
      :task="selectedTask"
      :project-id="selectedTask?.project_id ?? ''"
      :open="showModal"
      @update:open="showModal = $event"
      @saved="onSaved"
    />
  </div>
</template>
