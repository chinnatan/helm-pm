import type { Task, TaskStatus, TaskPriority, Subtask, Label, ActivityLog } from "~/types";
import type { Database } from "~/types/database";

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

const TASK_SELECT = `
  *,
  profiles:assignee_id(id, email, full_name, avatar_url),
  tester:tester_id(id, email, full_name, avatar_url),
  milestones:milestone_id(id, title, date, start_date, due_date),
  customers:customer_id(id, name),
  subtasks(*),
  task_labels(label_id, labels(*)),
  user_task_preferences(*)
`;

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

  async function addSubtask(taskId: string, title: string) {
    const task = tasks.value.find((t) => t.id === taskId);
    const maxSort = task?.subtasks?.reduce((max, s) => Math.max(max, s.sort_order), -1) ?? -1;

    const { data, error } = await supabase
      .from("subtasks")
      .insert({ task_id: taskId, title, sort_order: maxSort + 1 })
      .select()
      .single();

    if (!error && data && task) {
      if (!task.subtasks) task.subtasks = [];
      task.subtasks.push(data as Subtask);
    }
    return { data, error: error?.message };
  }

  async function toggleSubtask(subtaskId: string, completed: boolean) {
    const { error } = await supabase
      .from("subtasks")
      .update({ completed })
      .eq("id", subtaskId);

    if (!error) {
      for (const task of tasks.value) {
        const sub = task.subtasks?.find((s) => s.id === subtaskId);
        if (sub) sub.completed = completed;
      }
    }
    return { error: error?.message };
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
    toggleSubtask,
    setTaskLabels,
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
