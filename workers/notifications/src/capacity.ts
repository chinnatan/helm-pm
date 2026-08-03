import type { Env } from "./env";
import { supabaseGet, supabasePost, supabaseRpc } from "./supabase";

type SubtaskRow = {
  id: string;
  completed: boolean;
  assignee_id: string | null;
  estimate_hours: number | null;
  due_date: string | null;
};

type TaskRow = {
  id: string;
  project_id: string;
  assignee_id: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  start_date: string | null;
  estimate_hours: number | null;
  title: string;
  subtasks?: SubtaskRow[] | null;
};

type MemberRow = {
  user_id: string;
  role: string;
  profiles: { full_name: string | null; email: string } | null;
};

const CLOSED = new Set(["done", "release", "cancelled"]);
const PRIORITY_HOURS: Record<string, number> = {
  low: 2,
  medium: 4,
  high: 6,
  urgent: 8,
};

function effectiveHours(input: {
  estimate_hours?: number | null;
  priority: string;
}): number {
  if (input.estimate_hours != null && input.estimate_hours > 0) {
    return Number(input.estimate_hours);
  }
  return PRIORITY_HOURS[input.priority] ?? 4;
}

function capacitySlices(task: TaskRow): {
  assignee_id: string;
  hours: number;
  start_date: string | null;
  due_date: string | null;
}[] {
  const assignedSubs = (task.subtasks ?? []).filter(
    (s) => !s.completed && s.assignee_id,
  );
  if (assignedSubs.length > 0) {
    return assignedSubs.map((s) => ({
      assignee_id: s.assignee_id!,
      hours: effectiveHours({
        estimate_hours: s.estimate_hours,
        priority: task.priority,
      }),
      start_date: task.start_date,
      due_date: s.due_date ?? task.due_date,
    }));
  }
  if (!task.assignee_id) return [];
  return [
    {
      assignee_id: task.assignee_id,
      hours: effectiveHours(task),
      start_date: task.start_date,
      due_date: task.due_date,
    },
  ];
}

function weekKeyMonday(d: Date): string {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff),
  );
  return monday.toISOString().slice(0, 10);
}

function nextWeekStartKey(from = new Date()): string {
  const monday = weekKeyMonday(from);
  const d = new Date(`${monday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

function distributeHoursByWeek(
  hours: number,
  startDate: string | null,
  dueDate: string | null,
  fallbackWeekStart: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  if (hours <= 0) return result;

  const toDate = (s: string) => new Date(`${s}T12:00:00Z`);

  let rangeStart: Date | null = null;
  let rangeEnd: Date | null = null;

  if (startDate && dueDate) {
    const s = toDate(startDate);
    const e = toDate(dueDate);
    rangeStart = s <= e ? s : e;
    rangeEnd = s <= e ? e : s;
  } else if (dueDate) {
    rangeStart = rangeEnd = toDate(dueDate);
  } else if (startDate) {
    rangeStart = rangeEnd = toDate(startDate);
  } else {
    result[fallbackWeekStart] = (result[fallbackWeekStart] ?? 0) + hours;
    return result;
  }

  const weekdays: Date[] = [];
  const cur = new Date(rangeStart!);
  while (cur <= rangeEnd!) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) weekdays.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  if (weekdays.length === 0) {
    result[fallbackWeekStart] = (result[fallbackWeekStart] ?? 0) + hours;
    return result;
  }

  const perDay = hours / weekdays.length;
  for (const day of weekdays) {
    const key = weekKeyMonday(day);
    result[key] = (result[key] ?? 0) + perDay;
  }
  return result;
}

function loadPct(hours: number, capacity: number): number {
  if (capacity <= 0) return hours > 0 ? 100 : 0;
  return Math.round((hours / capacity) * 1000) / 10;
}

async function notificationExists(env: Env, type: string): Promise<boolean> {
  const { data } = await supabaseGet<{ id: string }[]>(
    env,
    `notifications?type=eq.${encodeURIComponent(type)}&select=id&limit=1`,
  );
  return (data?.length ?? 0) > 0;
}

async function notifyUser(
  env: Env,
  userId: string,
  type: string,
  message: string,
  metadata: Record<string, unknown>,
) {
  if (await notificationExists(env, type)) return;
  await supabasePost(env, "notifications", {
    user_id: userId,
    task_id: null,
    type,
    message,
    metadata,
  });
}

export async function runOverloadAlertsForWorkspace(
  env: Env,
  workspaceId: string,
): Promise<number> {
  const week = nextWeekStartKey();
  const thisWeek = weekKeyMonday(new Date());

  const { data: projects } = await supabaseGet<{ id: string }[]>(
    env,
    `projects?workspace_id=eq.${workspaceId}&archived_at=is.null&select=id`,
  );
  const projectIds = (projects ?? []).map((p) => p.id);
  if (projectIds.length === 0) return 0;

  const { data: tasks } = await supabaseGet<TaskRow[]>(
    env,
    `tasks?project_id=in.(${projectIds.join(",")})&select=id,project_id,assignee_id,status,priority,due_date,start_date,estimate_hours,title,subtasks(id,completed,assignee_id,estimate_hours,due_date)`,
  );

  const { data: members } = await supabaseGet<MemberRow[]>(
    env,
    `workspace_members?workspace_id=eq.${workspaceId}&select=user_id,role,profiles(full_name,email)`,
  );

  const managers = (members ?? [])
    .filter((m) => m.role === "admin" || m.role === "manager")
    .map((m) => m.user_id);

  const memberName = (uid: string) => {
    const m = members?.find((x) => x.user_id === uid);
    return m?.profiles?.full_name || m?.profiles?.email || uid;
  };

  const open = (tasks ?? []).filter((t) => !CLOSED.has(t.status));

  const planned: Record<string, Record<string, number>> = {};
  for (const task of open) {
    for (const slice of capacitySlices(task)) {
      const weeks = distributeHoursByWeek(
        slice.hours,
        slice.start_date,
        slice.due_date,
        thisWeek,
      );
      if (!planned[slice.assignee_id]) planned[slice.assignee_id] = {};
      for (const [wk, h] of Object.entries(weeks)) {
        planned[slice.assignee_id]![wk] =
          (planned[slice.assignee_id]![wk] ?? 0) + h;
      }
    }
  }

  const DEFAULT_CAP = 32;
  let count = 0;

  for (const m of members ?? []) {
    const uid = m.user_id;
    const nextHours = planned[uid]?.[week] ?? 0;
    const pct = loadPct(nextHours, DEFAULT_CAP);
    if (pct <= 100) continue;

    const name = memberName(uid);
    const typeBase = `capacity_overload:${uid}:${week}`;
    const message = `${name} is at ${pct}% load next week (${Math.round(nextHours * 10) / 10}h / ${DEFAULT_CAP}h)`;
    const meta = { workspace_id: workspaceId };

    const recipients = new Set(managers);
    recipients.add(uid);

    for (const rid of recipients) {
      await notifyUser(env, rid, `${typeBase}:${rid}`, message, meta);
      count++;
    }
  }

  return count;
}

export async function runCapacityCron(env: Env): Promise<{ overdue: number; overload: number }> {
  const { data: overdueCount, error } = await supabaseRpc(env, "run_capacity_alerts_cron");
  if (error) {
    console.error("run_capacity_alerts_cron", error);
  }

  const { data: workspaces } = await supabaseGet<{ id: string }[]>(
    env,
    "workspaces?select=id",
  );

  let overload = 0;
  for (const ws of workspaces ?? []) {
    overload += await runOverloadAlertsForWorkspace(env, ws.id);
  }

  return {
    overdue: typeof overdueCount === "number" ? overdueCount : 0,
    overload,
  };
}
