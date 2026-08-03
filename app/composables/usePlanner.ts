import type { Task, PlannerTab } from "~/types";
import { TASK_CLOSED_STATUSES } from "~/types";
import {
  startOfDay,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  isBefore,
  parseISO,
  format,
} from "date-fns";
import { taskInvolvesUser } from "~/utils/taskPeople";

const SUBTASK_SELECT = `
  *,
  profiles:assignee_id(id, email, full_name, avatar_url),
  tester:tester_id(id, email, full_name, avatar_url)
`;

const PLANNER_SELECT = `
  *,
  profiles:assignee_id(id, email, full_name, avatar_url),
  tester:tester_id(id, email, full_name, avatar_url),
  milestones:milestone_id(id, title, date, start_date, due_date),
  customers:customer_id(id, name),
  projects!inner(id, name, color, customer_id, workspace_id),
  subtasks(${SUBTASK_SELECT}),
  task_labels(label_id, labels(*)),
  user_task_preferences!inner(*)
`;

const TASK_SELECT = `
  *,
  profiles:assignee_id(id, email, full_name, avatar_url),
  tester:tester_id(id, email, full_name, avatar_url),
  milestones:milestone_id(id, title, date, start_date, due_date),
  customers:customer_id(id, name),
  projects!inner(id, name, color, customer_id, workspace_id),
  subtasks(${SUBTASK_SELECT}),
  task_labels(label_id, labels(*)),
  user_task_preferences(*)
`;

export function usePlanner() {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const { t } = useI18n();
  const { workspace } = useWorkspace();

  const activeTab = ref<PlannerTab>("today");
  const tasks = useState<Task[]>("plannerTasks", () => []);
  const loading = ref(false);

  const tabs = computed(() => [
    { value: "today" as PlannerTab, label: t("planner.today") },
    { value: "week" as PlannerTab, label: t("planner.week") },
    { value: "inbox" as PlannerTab, label: t("planner.inbox") },
    { value: "focus" as PlannerTab, label: t("planner.focus") },
  ]);

  async function fetchTasksInvolvingUser() {
    const uid = user.value!.id;
    const wsId = workspace.value!.id;
    const closed = `(${TASK_CLOSED_STATUSES.join(",")})`;

    const parentQuery = supabase
      .from("tasks")
      .select(TASK_SELECT)
      .or(`assignee_id.eq.${uid},tester_id.eq.${uid}`)
      .eq("projects.workspace_id", wsId)
      .not("status", "in", closed);

    const { data: parentTasks } = await parentQuery;
    const byId = new Map<string, Task>(
      ((parentTasks ?? []) as unknown as Task[]).map((t) => [t.id, t]),
    );

    const { data: subRows } = await supabase
      .from("subtasks")
      .select("task_id")
      .or(`assignee_id.eq.${uid},tester_id.eq.${uid}`);

    const missingIds = [
      ...new Set((subRows ?? []).map((s) => s.task_id).filter((id) => !byId.has(id))),
    ];

    if (missingIds.length > 0) {
      const { data: extra } = await supabase
        .from("tasks")
        .select(TASK_SELECT)
        .in("id", missingIds)
        .eq("projects.workspace_id", wsId)
        .not("status", "in", closed);

      for (const t of (extra ?? []) as unknown as Task[]) {
        byId.set(t.id, t);
      }
    }

    return [...byId.values()].filter((t) => taskInvolvesUser(t, uid));
  }

  async function fetchPlannerTasks() {
    if (!user.value || !workspace.value) {
      tasks.value = [];
      return;
    }
    loading.value = true;

    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    const wsId = workspace.value.id;
    const uid = user.value.id;

    if (activeTab.value === "focus") {
      const { data } = await supabase
        .from("tasks")
        .select(PLANNER_SELECT)
        .eq("user_task_preferences.is_pinned", true)
        .eq("user_task_preferences.user_id", uid)
        .eq("projects.workspace_id", wsId)
        .not("status", "in", `(${TASK_CLOSED_STATUSES.join(",")})`)
        .order("sort_order");

      tasks.value = ((data ?? []) as unknown as Task[]).filter((t) =>
        taskInvolvesUser(t, uid),
      );
    } else {
      let result = await fetchTasksInvolvingUser();

      if (activeTab.value === "inbox") {
        result = result.filter((t) => !t.due_date);
      } else if (activeTab.value === "today") {
        result = result.filter((t) => {
          if (!t.due_date) return false;
          const due = parseISO(t.due_date);
          return (
            format(due, "yyyy-MM-dd") === todayStr ||
            isBefore(due, startOfDay(today))
          );
        });
      } else if (activeTab.value === "week") {
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
        result = result.filter((t) => {
          if (!t.due_date) return false;
          const due = parseISO(t.due_date);
          return isWithinInterval(due, { start: weekStart, end: weekEnd });
        });
      }

      result.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });

      tasks.value = result;
    }

    loading.value = false;
  }

  async function togglePin(taskId: string, pinned: boolean) {
    if (!user.value) return;

    if (pinned) {
      await supabase.from("user_task_preferences").upsert({
        user_id: user.value.id,
        task_id: taskId,
        is_pinned: true,
        sort_order: 0,
      });
    } else {
      await supabase
        .from("user_task_preferences")
        .update({ is_pinned: false })
        .eq("user_id", user.value.id)
        .eq("task_id", taskId);
    }

    await fetchPlannerTasks();
  }

  async function markDone(taskId: string) {
    await supabase.from("tasks").update({ status: "done" }).eq("id", taskId);
    tasks.value = tasks.value.filter((t) => t.id !== taskId);
  }

  async function updateSortOrder(taskId: string, sortOrder: number) {
    if (!user.value) return;

    await supabase.from("user_task_preferences").upsert({
      user_id: user.value.id,
      task_id: taskId,
      sort_order: sortOrder,
      is_pinned: activeTab.value === "focus",
    });
  }

  watch(activeTab, () => fetchPlannerTasks());

  return {
    activeTab,
    tabs,
    tasks,
    loading,
    fetchPlannerTasks,
    togglePin,
    markDone,
    updateSortOrder,
  };
}
