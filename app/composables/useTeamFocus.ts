import type { Task } from "~/types";
import { TASK_CLOSED_STATUSES } from "~/types";
import { taskInvolvesUser } from "~/utils/taskPeople";

export const FOCUS_SOFT_LIMIT = 3;

export type FocusEntry = { userId: string; sortOrder: number; task: Task };

const FOCUS_SELECT = `
  user_id,
  sort_order,
  tasks!inner(
    *,
    features:feature_id(id, name, color),
    customers:customer_id(id, name),
    subtasks(assignee_id, tester_id)
  )
`;

/** งานที่ pin (focus) ของสมาชิกทุกคนใน workspace เรียงตาม sort_order ของแต่ละคน */
export function useTeamFocus() {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const { workspace } = useWorkspace();

  const entries = useState<FocusEntry[]>("team-focus", () => []);
  const loading = ref(false);

  async function fetchTeamFocus() {
    if (!workspace.value) return;
    loading.value = true;
    const { data, error } = await supabase
      .from("user_task_preferences")
      .select(FOCUS_SELECT)
      .eq("is_pinned", true)
      .eq("tasks.workspace_id", workspace.value.id)
      .not("tasks.status", "in", `(${TASK_CLOSED_STATUSES.join(",")})`)
      .order("sort_order");

    if (error) console.error("fetchTeamFocus failed:", error.message);
    entries.value = ((data ?? []) as unknown as { user_id: string; sort_order: number; tasks: Task }[])
      .map((row) => ({ userId: row.user_id, sortOrder: row.sort_order, task: row.tasks }))
      // เหมือนแท็บ Focus ของ My Planner: นับเฉพาะงานที่เกี่ยวกับคนนั้นจริง
      .filter((e) => taskInvolvesUser(e.task, e.userId));
    loading.value = false;
  }

  function focusOf(userId: string) {
    return entries.value
      .filter((e) => e.userId === userId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.task.title.localeCompare(b.task.title));
  }

  /** จัดลำดับ focus ของตัวเอง (RLS อนุญาตเฉพาะแถวของตัวเอง) */
  async function reorderOwnFocus(orderedTaskIds: string[]) {
    const uid = user.value?.id;
    if (!uid) return { error: "Not authenticated" };
    const results = await Promise.all(
      orderedTaskIds.map((taskId, i) =>
        supabase
          .from("user_task_preferences")
          .update({ sort_order: i })
          .eq("user_id", uid)
          .eq("task_id", taskId),
      ),
    );
    await fetchTeamFocus();
    return { error: results.find((r) => r.error)?.error?.message };
  }

  async function unfocus(taskId: string) {
    const uid = user.value?.id;
    if (!uid) return { error: "Not authenticated" };
    const { error } = await supabase
      .from("user_task_preferences")
      .update({ is_pinned: false })
      .eq("user_id", uid)
      .eq("task_id", taskId);
    await fetchTeamFocus();
    return { error: error?.message };
  }

  return { entries, loading, fetchTeamFocus, focusOf, reorderOwnFocus, unfocus };
}
