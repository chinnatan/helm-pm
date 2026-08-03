import type { Task, TaskStatus, TaskPriority, Subtask, Label, ActivityLog } from "~/types";
import type { Database } from "~/types/database";
import { isTaskClosed } from "~/types";

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
type SubtaskUpdate = Database["public"]["Tables"]["subtasks"]["Update"];

const SUBTASK_SELECT = `
  *,
  profiles:assignee_id(id, email, full_name, avatar_url),
  tester:tester_id(id, email, full_name, avatar_url),
  subtask_labels(label_id, labels(*))
`;

const TASK_SELECT = `
  *,
  profiles:assignee_id(id, email, full_name, avatar_url),
  tester:tester_id(id, email, full_name, avatar_url),
  milestones:milestone_id(id, title, date, start_date, due_date),
  customers:customer_id(id, name),
  subtasks(${SUBTASK_SELECT}),
  task_labels(label_id, labels(*)),
  user_task_preferences(*)
`;

export type AddSubtaskInput = {
  assignee_id?: string | null;
  tester_id?: string | null;
  estimate_hours?: number | null;
  due_date?: string | null;
  status?: TaskStatus;
};

export function useTasks(projectId?: Ref<string | undefined>) {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();

  const tasks = useState<Task[]>("tasks", () => []);
  const loading = ref(false);
  const searchQuery = ref("");

  async function fetchTasks(pid?: string) {
    const id = pid ?? projectId?.value;
    if (!id) return;
    loading.value = true;

    let query = supabase
      .from("tasks")
      .select(TASK_SELECT)
      .eq("project_id", id)
      .order("sort_order");

    if (searchQuery.value) {
      query = query.or(
        `title.ilike.%${searchQuery.value}%,description.ilike.%${searchQuery.value}%`,
      );
    }

    const { data, error } = await query;
    if (error) {
      console.error("fetchTasks failed:", error.message);
      loading.value = false;
      return;
    }
    tasks.value = (data ?? []) as Task[];
    loading.value = false;
  }

  async function createTask(input: {
    project_id: string;
    title: string;
    description?: string;
    assignee_id?: string | null;
    tester_id?: string | null;
    milestone_id?: string | null;
    customer_id?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    due_date?: string | null;
    start_date?: string | null;
    estimate_hours?: number | null;
  }) {
    const maxSort = tasks.value.reduce((max, t) => Math.max(max, t.sort_order), -1);

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        ...input,
        created_by: user.value?.id,
        sort_order: maxSort + 1,
      })
      .select(TASK_SELECT)
      .single();

    if (!error && data) {
      tasks.value.push(data as Task);
    }
    return { data: data as Task | null, error: error?.message };
  }

  async function updateTask(id: string, updates: TaskUpdate) {
    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .select(TASK_SELECT)
      .single();

    if (error) {
      console.error("updateTask failed:", error.message);
      return { data: null, error: error.message };
    }

    if (data) {
      const idx = tasks.value.findIndex((t) => t.id === id);
      if (idx >= 0) tasks.value[idx] = data as Task;
    }
    return { data: data as Task | null, error: undefined };
  }

  async function deleteTask(id: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (!error) {
      tasks.value = tasks.value.filter((t) => t.id !== id);
    }
    return { error: error?.message };
  }

  async function updateTaskStatus(id: string, status: TaskStatus, sortOrder?: number) {
    const updates: TaskUpdate = { status };
    if (sortOrder !== undefined) updates.sort_order = sortOrder;
    return updateTask(id, updates);
  }

  function findSubtask(subtaskId: string): { task: Task; sub: Subtask } | null {
    for (const task of tasks.value) {
      const sub = task.subtasks?.find((s) => s.id === subtaskId);
      if (sub) return { task, sub };
    }
    return null;
  }

  async function addSubtask(taskId: string, title: string, opts: AddSubtaskInput = {}) {
    const task = tasks.value.find((t) => t.id === taskId);
    const maxSort = task?.subtasks?.reduce((max, s) => Math.max(max, s.sort_order), -1) ?? -1;
    const status = opts.status ?? task?.status ?? "todo";

    const { data, error } = await supabase
      .from("subtasks")
      .insert({
        task_id: taskId,
        title,
        sort_order: maxSort + 1,
        status,
        assignee_id: opts.assignee_id ?? null,
        tester_id: opts.tester_id ?? null,
        estimate_hours: opts.estimate_hours ?? null,
        due_date: opts.due_date ?? null,
      })
      .select(SUBTASK_SELECT)
      .single();

    if (!error && data && task) {
      if (!task.subtasks) task.subtasks = [];
      task.subtasks.push(data as Subtask);
    }
    return { data: data as Subtask | null, error: error?.message };
  }

  async function updateSubtask(subtaskId: string, updates: SubtaskUpdate) {
    const { data, error } = await supabase
      .from("subtasks")
      .update(updates)
      .eq("id", subtaskId)
      .select(SUBTASK_SELECT)
      .single();

    if (error) {
      console.error("updateSubtask failed:", error.message);
      return { data: null, error: error.message };
    }

    if (data) {
      const found = findSubtask(subtaskId);
      if (found) {
        const idx = found.task.subtasks!.findIndex((s) => s.id === subtaskId);
        if (idx >= 0) found.task.subtasks![idx] = data as Subtask;
      }
    }
    return { data: data as Subtask | null, error: undefined };
  }

  async function updateSubtaskStatus(
    subtaskId: string,
    status: TaskStatus,
    sortOrder?: number,
  ) {
    const updates: SubtaskUpdate = { status };
    if (sortOrder !== undefined) updates.sort_order = sortOrder;
    return updateSubtask(subtaskId, updates);
  }

  async function toggleSubtask(subtaskId: string, completed: boolean) {
    const found = findSubtask(subtaskId);
    const openStatus =
      found && !isTaskClosed(found.task.status) ? found.task.status : "todo";
    return updateSubtask(subtaskId, {
      status: completed ? "done" : openStatus,
    });
  }

  async function deleteSubtask(subtaskId: string) {
    const { error } = await supabase.from("subtasks").delete().eq("id", subtaskId);
    if (!error) {
      for (const task of tasks.value) {
        if (!task.subtasks) continue;
        task.subtasks = task.subtasks.filter((s) => s.id !== subtaskId);
      }
    }
    return { error: error?.message };
  }

  async function reorderSubtasks(taskId: string, orderedIds: string[]) {
    const task = tasks.value.find((t) => t.id === taskId);
    if (task?.subtasks) {
      const byId = new Map(task.subtasks.map((s) => [s.id, s]));
      task.subtasks = orderedIds
        .map((id, i) => {
          const sub = byId.get(id);
          if (sub) sub.sort_order = i;
          return sub;
        })
        .filter(Boolean) as Subtask[];
    }

    const results = await Promise.all(
      orderedIds.map((id, i) =>
        supabase.from("subtasks").update({ sort_order: i }).eq("id", id),
      ),
    );
    const failed = results.find((r) => r.error);
    return { error: failed?.error?.message };
  }

  async function setTaskLabels(taskId: string, labelIds: string[]) {
    await supabase.from("task_labels").delete().eq("task_id", taskId);

    if (labelIds.length > 0) {
      await supabase
        .from("task_labels")
        .insert(labelIds.map((label_id) => ({ task_id: taskId, label_id })));
    }

    await fetchTasks();
  }

  async function setSubtaskLabels(subtaskId: string, labelIds: string[]) {
    await supabase.from("subtask_labels").delete().eq("subtask_id", subtaskId);

    if (labelIds.length > 0) {
      await supabase
        .from("subtask_labels")
        .insert(labelIds.map((label_id) => ({ subtask_id: subtaskId, label_id })));
    }

    await fetchTasks();
  }

  async function fetchActivity(taskId: string) {
    const { data } = await supabase
      .from("activity_log")
      .select("*, profiles(id, email, full_name)")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    return (data ?? []) as ActivityLog[];
  }

  function subscribeToProject(pid: string, onUpdate: () => void) {
    // ไม่ใส่ filter บน project_id — กัน "invalid column for filter"
    // กรองฝั่ง client จาก payload แทน
    const channel = supabase
      .channel(`tasks:${pid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { project_id?: string };
          if (row.project_id === pid) onUpdate();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  const tasksByStatus = computed(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      ready_for_test: [],
      testing: [],
      done: [],
      release: [],
      cancelled: [],
    };
    for (const task of tasks.value) {
      const bucket = grouped[task.status];
      if (bucket) bucket.push(task);
      else grouped.todo.push(task);
    }
    for (const status of Object.keys(grouped) as TaskStatus[]) {
      grouped[status]?.sort((a, b) => a.sort_order - b.sort_order);
    }
    return grouped;
  });

  return {
    tasks,
    loading,
    searchQuery,
    tasksByStatus,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    addSubtask,
    updateSubtask,
    updateSubtaskStatus,
    toggleSubtask,
    deleteSubtask,
    reorderSubtasks,
    setTaskLabels,
    setSubtaskLabels,
    fetchActivity,
    subscribeToProject,
  };
}

export function useLabels() {
  const supabase = useSupabaseClient();
  const { workspace } = useWorkspace();

  const labels = useState<Label[]>("labels", () => []);

  async function fetchLabels() {
    if (!workspace.value) return;

    const { data } = await supabase
      .from("labels")
      .select("*")
      .eq("workspace_id", workspace.value.id)
      .order("name");

    labels.value = (data ?? []) as Label[];
  }

  async function createLabel(name: string, color: string = "#64748b") {
    if (!workspace.value) return null;

    const { data, error } = await supabase
      .from("labels")
      .insert({ workspace_id: workspace.value.id, name, color })
      .select()
      .single();

    if (!error && data) labels.value.push(data as Label);
    return { data, error: error?.message };
  }

  return { labels, fetchLabels, createLabel };
}
