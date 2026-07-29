import {
  addDays,
  addWeeks,
  eachDayOfInterval,
  format,
  isWeekend,
  parseISO,
  startOfWeek,
  subWeeks,
} from "date-fns";
import type { Milestone, Task, TaskPriority, WorkspaceMember } from "~/types";
import {
  DEFAULT_WEEKLY_CAPACITY_HOURS,
  effectiveTaskHours,
  isTaskClosed,
  MILESTONE_CLOSED_STATUSES,
} from "~/types";
import {
  toMonthKey,
  weekCapacityFromMonths,
} from "~/utils/capacityCalendar";
import { useMemberMonthCapacities } from "~/composables/useMemberMonthCapacities";

export type CapacityTask = Pick<
  Task,
  | "id"
  | "project_id"
  | "assignee_id"
  | "status"
  | "priority"
  | "due_date"
  | "start_date"
  | "estimate_hours"
  | "title"
  | "created_at"
> & {
  projects?: { id: string; name: string; color?: string } | null;
};

export interface MemberCapacityRow {
  userId: string;
  membershipId: string;
  name: string;
  capacityHours: number;
  nextWeekCapacityHours: number;
  activeTaskCount: number;
  overdueCount: number;
  remainingHours: number;
  unplannedCount: number;
  thisWeekHours: number;
  nextWeekHours: number;
  thisWeekPct: number;
  nextWeekPct: number;
}

export interface WeekBucket {
  weekStart: string;
  label: string;
  plannedHours: number;
  actualBurnHours: number;
  byMember: Record<string, number>;
}

export interface ProjectAssigneeLoad {
  userId: string;
  name: string;
  remainingHours: number;
  activeTaskCount: number;
  overdueCount: number;
  thisWeekHours: number;
  capacityHours: number;
  thisWeekPct: number;
}

function weekKey(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  try {
    return parseISO(value);
  } catch {
    return null;
  }
}

/** Spread hours across Mon–Fri between start and due (inclusive). */
export function distributeHoursByWeek(
  hours: number,
  startDate: string | null,
  dueDate: string | null,
  fallbackWeekStart: Date,
): Record<string, number> {
  const result: Record<string, number> = {};
  if (hours <= 0) return result;

  const start = parseDateOnly(startDate);
  const due = parseDateOnly(dueDate);

  let rangeStart: Date;
  let rangeEnd: Date;

  if (start && due) {
    rangeStart = start <= due ? start : due;
    rangeEnd = start <= due ? due : start;
  } else if (due) {
    rangeStart = due;
    rangeEnd = due;
  } else if (start) {
    rangeStart = start;
    rangeEnd = start;
  } else {
    const key = weekKey(fallbackWeekStart);
    result[key] = (result[key] ?? 0) + hours;
    return result;
  }

  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd }).filter(
    (d) => !isWeekend(d),
  );
  const workDays = days.length > 0 ? days : [rangeEnd];
  const perDay = hours / workDays.length;

  for (const day of workDays) {
    const key = weekKey(day);
    result[key] = (result[key] ?? 0) + perDay;
  }
  return result;
}

export function loadPct(hours: number, capacity: number): number {
  if (capacity <= 0) return hours > 0 ? 999 : 0;
  return Math.round((hours / capacity) * 100);
}

export function loadTone(pct: number): "ok" | "warn" | "over" {
  if (pct > 100) return "over";
  if (pct > 85) return "warn";
  return "ok";
}

export function useTeamCapacity() {
  const supabase = useSupabaseClient();
  const { workspace, members } = useWorkspace();
  const {
    monthHours,
    fetchMonthCapacities,
    baselineWeekly,
  } = useMemberMonthCapacities();
  const { fetchMonthCalendars } = useWorkspaceMonthCalendar();

  const loading = ref(false);
  const tasks = ref<CapacityTask[]>([]);
  const closedTaskMap = ref<Record<string, CapacityTask>>({});
  const burnEvents = ref<
    Array<{ task_id: string; created_at: string; assignee_id: string | null }>
  >([]);

  const forwardWeeks = 6;
  const burnLookbackWeeks = 4;

  async function fetchCapacityData(projectIds?: string[]) {
    if (!workspace.value) return;
    loading.value = true;

    try {
      const fromMonth = toMonthKey(subWeeks(new Date(), burnLookbackWeeks + 1));
      const toMonth = toMonthKey(addWeeks(new Date(), forwardWeeks + 2));
      await Promise.all([
        fetchMonthCalendars({ fromMonth, toMonth }),
        fetchMonthCapacities({ fromMonth, toMonth }),
      ]);

      let ids = projectIds;
      if (!ids) {
        const { data: projects } = await supabase
          .from("projects")
          .select("id")
          .eq("workspace_id", workspace.value.id)
          .is("archived_at", null);
        ids = (projects ?? []).map((p) => p.id);
      }

      if (ids.length === 0) {
        tasks.value = [];
        burnEvents.value = [];
        closedTaskMap.value = {};
        return;
      }

      const { data: openTasks } = await supabase
        .from("tasks")
        .select(
          "id, project_id, assignee_id, status, priority, due_date, start_date, estimate_hours, title, created_at",
        )
        .in("project_id", ids)
        .not("status", "in", "(done,release,cancelled)");

      tasks.value = (openTasks ?? []) as unknown as CapacityTask[];

      const since = subWeeks(new Date(), burnLookbackWeeks + 1).toISOString();
      const { data: logs } = await supabase
        .from("activity_log")
        .select("task_id, created_at, new_value")
        .eq("field_name", "status")
        .in("new_value", ["done", "release"])
        .gte("created_at", since);

      const taskIds = [...new Set((logs ?? []).map((l) => l.task_id))];
      let closed: CapacityTask[] = [];
      if (taskIds.length > 0) {
        const { data: closedRows } = await supabase
          .from("tasks")
          .select(
            "id, project_id, assignee_id, status, priority, due_date, start_date, estimate_hours, title, created_at",
          )
          .in("id", taskIds)
          .in("project_id", ids);
        closed = (closedRows ?? []) as unknown as CapacityTask[];
      }

      const map: Record<string, CapacityTask> = {};
      for (const t of closed) map[t.id] = t;
      closedTaskMap.value = map;

      burnEvents.value = (logs ?? [])
        .filter((l) => map[l.task_id])
        .map((l) => ({
          task_id: l.task_id,
          created_at: l.created_at,
          assignee_id: map[l.task_id]?.assignee_id ?? null,
        }));
    } finally {
      loading.value = false;
    }
  }

  function memberName(userId: string) {
    const m = members.value.find((x) => x.user_id === userId);
    return m?.profiles?.full_name || m?.profiles?.email || userId;
  }

  /** Baseline weekly (ignores monthly overrides) — for display defaults */
  function memberCapacity(userId: string) {
    return baselineWeekly(userId);
  }

  /** Effective capacity for a given week (Mon start), using monthly spreadsheet */
  function memberCapacityForWeek(userId: string, weekStart: Date | string) {
    const start =
      typeof weekStart === "string" ? parseISO(weekStart) : weekStart;
    return weekCapacityFromMonths(start, (mk) => monthHours(userId, mk));
  }

  const today = computed(() => format(new Date(), "yyyy-MM-dd"));
  const thisWeekStart = computed(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const thisWeekKey = computed(() => weekKey(thisWeekStart.value));
  const nextWeekKey = computed(() =>
    weekKey(addWeeks(thisWeekStart.value, 1)),
  );

  const openAssigned = computed(() =>
    tasks.value.filter((t) => t.assignee_id && !isTaskClosed(t.status as Task["status"])),
  );

  function plannedByMemberWeek(scopeTasks: CapacityTask[]): Record<
    string,
    Record<string, number>
  > {
    const out: Record<string, Record<string, number>> = {};
    for (const task of scopeTasks) {
      if (!task.assignee_id || isTaskClosed(task.status as Task["status"])) continue;
      const hours = effectiveTaskHours({
        estimate_hours: task.estimate_hours,
        priority: task.priority as TaskPriority,
      });
      const weeks = distributeHoursByWeek(
        hours,
        task.start_date,
        task.due_date,
        thisWeekStart.value,
      );
      if (!out[task.assignee_id]) out[task.assignee_id] = {};
      for (const [wk, h] of Object.entries(weeks)) {
        out[task.assignee_id]![wk] = (out[task.assignee_id]![wk] ?? 0) + h;
      }
    }
    return out;
  }

  const plannedMatrix = computed(() => plannedByMemberWeek(openAssigned.value));

  const memberRows = computed((): MemberCapacityRow[] => {
    return members.value.map((m: WorkspaceMember) => {
      const uid = m.user_id;
      const thisWeekCap = memberCapacityForWeek(uid, thisWeekStart.value);
      const nextWeekCap = memberCapacityForWeek(
        uid,
        addWeeks(thisWeekStart.value, 1),
      );
      const mine = openAssigned.value.filter((t) => t.assignee_id === uid);
      const remainingHours = mine.reduce(
        (sum, t) =>
          sum +
          effectiveTaskHours({
            estimate_hours: t.estimate_hours,
            priority: t.priority as TaskPriority,
          }),
        0,
      );
      const overdueCount = mine.filter(
        (t) => t.due_date && t.due_date < today.value,
      ).length;
      const unplannedCount = mine.filter(
        (t) => !t.start_date && !t.due_date,
      ).length;
      const thisWeekHours = plannedMatrix.value[uid]?.[thisWeekKey.value] ?? 0;
      const nextWeekHours = plannedMatrix.value[uid]?.[nextWeekKey.value] ?? 0;

      return {
        userId: uid,
        membershipId: m.id,
        name: memberName(uid),
        capacityHours: thisWeekCap,
        nextWeekCapacityHours: nextWeekCap,
        activeTaskCount: mine.length,
        overdueCount,
        remainingHours: Math.round(remainingHours * 10) / 10,
        unplannedCount,
        thisWeekHours: Math.round(thisWeekHours * 10) / 10,
        nextWeekHours: Math.round(nextWeekHours * 10) / 10,
        thisWeekPct: loadPct(thisWeekHours, thisWeekCap),
        nextWeekPct: loadPct(nextWeekHours, nextWeekCap),
      };
    });
  });

  const workspaceSummary = computed(() => {
    const remainingHours = memberRows.value.reduce(
      (s, r) => s + r.remainingHours,
      0,
    );
    const activeTaskCount = memberRows.value.reduce(
      (s, r) => s + r.activeTaskCount,
      0,
    );
    const overdueCount = memberRows.value.reduce((s, r) => s + r.overdueCount, 0);
    const teamCapacity = memberRows.value.reduce(
      (s, r) => s + r.capacityHours,
      0,
    );
    const thisWeekHours = memberRows.value.reduce(
      (s, r) => s + r.thisWeekHours,
      0,
    );
    return {
      remainingHours: Math.round(remainingHours * 10) / 10,
      activeTaskCount,
      overdueCount,
      teamCapacity,
      thisWeekHours: Math.round(thisWeekHours * 10) / 10,
      thisWeekPct: loadPct(thisWeekHours, teamCapacity),
    };
  });

  const forwardWeekBuckets = computed((): WeekBucket[] => {
    const buckets: WeekBucket[] = [];
    for (let i = 0; i < forwardWeeks; i++) {
      const start = addWeeks(thisWeekStart.value, i);
      const key = weekKey(start);
      const byMember: Record<string, number> = {};
      let planned = 0;
      for (const row of memberRows.value) {
        const h = plannedMatrix.value[row.userId]?.[key] ?? 0;
        if (h > 0) byMember[row.userId] = Math.round(h * 10) / 10;
        planned += h;
      }
      buckets.push({
        weekStart: key,
        label: format(start, "d MMM"),
        plannedHours: Math.round(planned * 10) / 10,
        actualBurnHours: 0,
        byMember,
      });
    }
    return buckets;
  });

  const burnWeekBuckets = computed((): WeekBucket[] => {
    const buckets: WeekBucket[] = [];
    for (let i = burnLookbackWeeks - 1; i >= 0; i--) {
      const start = subWeeks(thisWeekStart.value, i);
      const key = weekKey(start);
      let burn = 0;
      const byMember: Record<string, number> = {};

      for (const ev of burnEvents.value) {
        const created = parseISO(ev.created_at);
        if (weekKey(created) !== key) continue;
        const task = closedTaskMap.value[ev.task_id];
        if (!task) continue;
        const hours = effectiveTaskHours({
          estimate_hours: task.estimate_hours,
          priority: task.priority as TaskPriority,
        });
        burn += hours;
        const uid = ev.assignee_id;
        if (uid) {
          byMember[uid] = (byMember[uid] ?? 0) + hours;
        }
      }

      let planned = 0;
      // historical planned is approximate: only current open tasks don't apply;
      // use intake of tasks created that week as "planned intake" proxy instead
      for (const task of [...tasks.value, ...Object.values(closedTaskMap.value)]) {
        try {
          if (weekKey(parseISO(task.created_at)) === key) {
            planned += effectiveTaskHours({
              estimate_hours: task.estimate_hours,
              priority: task.priority as TaskPriority,
            });
          }
        } catch {
          /* ignore */
        }
      }

      buckets.push({
        weekStart: key,
        label: format(start, "d MMM"),
        plannedHours: Math.round(planned * 10) / 10,
        actualBurnHours: Math.round(burn * 10) / 10,
        byMember,
      });
    }
    return buckets;
  });

  const avgWeeklyBurn = computed(() => {
    const burns = burnWeekBuckets.value.map((b) => b.actualBurnHours);
    if (burns.length === 0) return 0;
    const sum = burns.reduce((a, b) => a + b, 0);
    return Math.round((sum / burns.length) * 10) / 10;
  });

  const runwayWeeks = computed(() => {
    const avg = avgWeeklyBurn.value;
    if (avg <= 0) return null;
    return Math.round((workspaceSummary.value.remainingHours / avg) * 10) / 10;
  });

  function projectAssigneeLoads(
    projectId: string,
    scopeMembers?: WorkspaceMember[],
  ): ProjectAssigneeLoad[] {
    const list = scopeMembers ?? members.value;
    const projectTasks = openAssigned.value.filter(
      (t) => t.project_id === projectId,
    );
    const matrix = plannedByMemberWeek(projectTasks);
    const userIds = new Set(
      projectTasks.map((t) => t.assignee_id).filter(Boolean) as string[],
    );

    return [...userIds]
      .map((uid) => {
        const mine = projectTasks.filter((t) => t.assignee_id === uid);
        const remainingHours = mine.reduce(
          (sum, t) =>
            sum +
            effectiveTaskHours({
              estimate_hours: t.estimate_hours,
              priority: t.priority as TaskPriority,
            }),
          0,
        );
        const capacity = memberCapacityForWeek(uid, thisWeekStart.value);
        const thisWeekHours = matrix[uid]?.[thisWeekKey.value] ?? 0;
        return {
          userId: uid,
          name: memberName(uid),
          remainingHours: Math.round(remainingHours * 10) / 10,
          activeTaskCount: mine.length,
          overdueCount: mine.filter(
            (t) => t.due_date && t.due_date < today.value,
          ).length,
          thisWeekHours: Math.round(thisWeekHours * 10) / 10,
          capacityHours: capacity,
          thisWeekPct: loadPct(thisWeekHours, capacity),
        };
      })
      .sort((a, b) => b.remainingHours - a.remainingHours);
  }

  function upcomingMilestones(
    milestones: Milestone[],
    limit = 3,
  ): Milestone[] {
    const todayStr = today.value;
    return [...milestones]
      .filter(
        (m) =>
          (m.due_date || m.date) >= todayStr &&
          !MILESTONE_CLOSED_STATUSES.includes(m.status),
      )
      .sort((a, b) =>
        (a.due_date || a.date).localeCompare(b.due_date || b.date),
      )
      .slice(0, limit);
  }

  function overloadedNextWeek(): MemberCapacityRow[] {
    return memberRows.value.filter((r) => r.nextWeekPct > 100);
  }

  return {
    loading,
    tasks,
    fetchCapacityData,
    memberRows,
    workspaceSummary,
    forwardWeekBuckets,
    burnWeekBuckets,
    avgWeeklyBurn,
    runwayWeeks,
    thisWeekKey,
    nextWeekKey,
    projectAssigneeLoads,
    upcomingMilestones,
    overloadedNextWeek,
    memberCapacity,
    memberCapacityForWeek,
    openAssigned,
    effectiveTaskHours,
    loadPct,
    loadTone,
  };
}

/** Next Monday date string for alert dedupe keys */
export function nextWeekStartKey(from = new Date()): string {
  return format(addWeeks(startOfWeek(from, { weekStartsOn: 1 }), 1), "yyyy-MM-dd");
}

export function thisWeekStartKey(from = new Date()): string {
  return format(startOfWeek(from, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function daysFromNow(n: number): string {
  return format(addDays(new Date(), n), "yyyy-MM-dd");
}
