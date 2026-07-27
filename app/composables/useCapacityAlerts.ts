import type { Project } from "~/types";
import { isTaskClosed } from "~/types";
import {
  nextWeekStartKey,
  useTeamCapacity,
  type CapacityTask,
} from "~/composables/useTeamCapacity";

/** Alert when a project has this many or more overdue open tasks */
export const PROJECT_OVERDUE_ALERT_THRESHOLD = 3;

/**
 * Capacity / overdue alerts using the existing notifications table.
 * Dedupe key is encoded in `type` so the same week/project does not spam.
 */
export function useCapacityAlerts() {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const { t } = useI18n();
  const { workspace, members, canManageMembers } = useWorkspace();
  const capacity = useTeamCapacity();

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function notificationExists(type: string): Promise<boolean> {
    const { data } = await supabase
      .from("notifications")
      .select("id")
      .eq("type", type)
      .limit(1)
      .maybeSingle();
    return !!data;
  }

  async function notifyUser(userId: string, type: string, message: string) {
    if (await notificationExists(type)) return;

    await supabase.from("notifications").insert({
      user_id: userId,
      task_id: null,
      type,
      message,
    });
  }

  function managerAdminIds(): string[] {
    return members.value
      .filter((m) => m.role === "admin" || m.role === "manager")
      .map((m) => m.user_id);
  }

  async function checkOverloadAlerts() {
    if (!workspace.value || !user.value || !canManageMembers.value) return;

    const week = nextWeekStartKey();
    const overloaded = capacity.overloadedNextWeek();

    for (const row of overloaded) {
      const type = `capacity_overload:${row.userId}:${week}`;
      const message = t("capacity.alertOverload", {
        name: row.name,
        pct: row.nextWeekPct,
        hours: row.nextWeekHours,
        capacity: row.nextWeekCapacityHours,
      });

      const recipients = new Set(managerAdminIds());
      recipients.add(row.userId);

      for (const uid of recipients) {
        await notifyUser(uid, `${type}:${uid}`, message);
      }
    }
  }

  async function checkProjectOverdueAlerts(
    projects: Project[],
    tasks: CapacityTask[],
  ) {
    if (!workspace.value || !user.value || !canManageMembers.value) return;

    const today = new Date().toISOString().slice(0, 10);
    const week = nextWeekStartKey();

    for (const project of projects) {
      if (project.archived_at) continue;
      const overdue = tasks.filter(
        (task) =>
          task.project_id === project.id &&
          !isTaskClosed(task.status as never) &&
          !!task.due_date &&
          task.due_date < today,
      );
      if (overdue.length < PROJECT_OVERDUE_ALERT_THRESHOLD) continue;

      const typeBase = `project_overdue:${project.id}:${week}`;
      const message = t("capacity.alertOverdue", {
        project: project.name,
        count: overdue.length,
      });

      const recipients = new Set(managerAdminIds());
      if (project.owner_id) recipients.add(project.owner_id);

      for (const uid of recipients) {
        await notifyUser(uid, `${typeBase}:${uid}`, message);
      }
    }
  }

  async function runCapacityAlerts(options?: {
    projects?: Project[];
  }) {
    if (!canManageMembers.value) return;
    await capacity.fetchCapacityData();
    await checkOverloadAlerts();

    if (options?.projects) {
      await checkProjectOverdueAlerts(options.projects, capacity.tasks.value);
    }
  }

  function scheduleCapacityAlerts(options?: { projects?: Project[] }) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void runCapacityAlerts(options);
    }, 800);
  }

  return {
    runCapacityAlerts,
    scheduleCapacityAlerts,
    checkOverloadAlerts,
    checkProjectOverdueAlerts,
  };
}
