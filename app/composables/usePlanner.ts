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

const PLANNER_SELECT = `
  *,
  profiles:assignee_id(id, email, full_name, avatar_url),
  tester:tester_id(id, email, full_name, avatar_url),
  milestones:milestone_id(id, title, date, start_date, due_date),
  customers:customer_id(id, name),
  projects!inner(id, name, color, customer_id, workspace_id),
  subtasks(*),
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
  subtasks(*),
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

  function mineFilter() {
    if (!user.value) return "assignee_id.eq.null";
    const id = user.value.id;
    return `assignee_id.eq.${id},tester_id.eq.${id}`;
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

    if (activeTab.value === "focus") {
      const { data } = await supabase
        .from("tasks")
        .select(PLANNER_SELECT)
        .or(mineFilter())
        .eq("user_task_preferences.is_pinned", true)
        .eq("projects.workspace_id", wsId)
        .not("status", "in", `(${TASK_CLOSED_STATUSES.join(",")})`)
        .order("sort_order");

      tasks.value = (data ?? []) as unknown as Task[];
    } else {
      let query = supabase
        .from("tasks")
        .select(TASK_SELECT)
        .or(mineFilter())
        .eq("projects.workspace_id", wsId)
        .not("status", "in", `(${TASK_CLOSED_STATUSES.join(",")})`);

      if (activeTab.value === "inbox") {
        query = query.is("due_date", null);
      }

      const { data } = await query.order("due_date", { ascending: true, nullsFirst: false });
      let result = (data ?? []) as unknown as Task[];

      if (activeTab.value === "today") {
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
