import type { Comment, Milestone, MilestoneStatus, Task, TaskDependency, Notification, Attachment } from "~/types";
import { isTaskClosed } from "~/types";
import {
  graphWouldCreateCycle,
  graphBlockedBy,
  graphIsBlocked,
} from "~/utils/dependencyGraph";

export function useComments(
  taskId: Ref<string | undefined>,
  subtaskId?: Ref<string | undefined | null>,
) {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const comments = ref<Comment[]>([]);

  async function fetchComments() {
    if (!taskId.value) return;

    let query = supabase
      .from("comments")
      .select("*, profiles(id, email, full_name, avatar_url)")
      .eq("task_id", taskId.value)
      .order("created_at");

    const sid = subtaskId ? toValue(subtaskId) : null;
    if (sid) {
      query = query.eq("subtask_id", sid);
    } else {
      query = query.is("subtask_id", null);
    }

    const { data } = await query;
    comments.value = (data ?? []) as unknown as Comment[];
  }

  async function addComment(content: string) {
    if (!taskId.value || !user.value) return;

    const sid = subtaskId ? toValue(subtaskId) : null;
    const { data, error } = await supabase
      .from("comments")
      .insert({
        task_id: taskId.value,
        subtask_id: sid || null,
        user_id: user.value.id,
        content,
      })
      .select("*, profiles(id, email, full_name, avatar_url)")
      .single();

    if (!error && data) comments.value.push(data as unknown as Comment);

    // Create notification for assignee mentions
    const mentions = content.match(/@(\S+)/g);
    if (mentions) {
      const { data: taskRow } = await supabase
        .from("tasks")
        .select("project_id")
        .eq("id", taskId.value)
        .single();

      for (const mention of mentions) {
        const email = mention.slice(1);
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .single();

        if (profile && profile.id !== user.value.id) {
          await supabase.from("notifications").insert({
            user_id: profile.id,
            task_id: taskId.value,
            type: "mention",
            message: `${user.value.email} mentioned you in a comment`,
            metadata: {
              ...(taskRow?.project_id ? { project_id: taskRow.project_id } : {}),
              ...(sid ? { subtask_id: sid } : {}),
            },
          });
        }
      }
    }

    return { error: error?.message };
  }

  watch([taskId, () => (subtaskId ? toValue(subtaskId) : null)], fetchComments, {
    immediate: true,
  });

  return { comments, fetchComments, addComment };
}

export function useMilestones(projectId: Ref<string | undefined>) {
  const supabase = useSupabaseClient();
  const milestones = ref<Milestone[]>([]);

  async function fetchMilestones() {
    if (!projectId.value) return;

    const { data } = await supabase
      .from("milestones")
      .select("*")
      .eq("project_id", projectId.value)
      .order("start_date");

    milestones.value = (data ?? []) as Milestone[];
  }

  async function createMilestone(
    title: string,
    startDate: string,
    dueDate: string,
    status: MilestoneStatus = "planned",
  ) {
    if (!projectId.value) return;

    const { data, error } = await supabase
      .from("milestones")
      .insert({
        project_id: projectId.value,
        title,
        start_date: startDate,
        due_date: dueDate,
        date: dueDate,
        status,
      })
      .select()
      .single();

    if (!error && data) milestones.value.push(data as Milestone);
    return { data, error: error?.message };
  }

  async function updateMilestone(
    id: string,
    updates: {
      title?: string;
      start_date?: string;
      due_date?: string;
      status?: MilestoneStatus;
    },
  ) {
    const payload = {
      ...updates,
      ...(updates.due_date ? { date: updates.due_date } : {}),
    };

    const { data, error } = await supabase
      .from("milestones")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      const idx = milestones.value.findIndex((m) => m.id === id);
      if (idx >= 0) milestones.value[idx] = data as Milestone;
    }
    return { data, error: error?.message };
  }

  async function deleteMilestone(id: string) {
    await supabase.from("milestones").delete().eq("id", id);
    milestones.value = milestones.value.filter((m) => m.id !== id);
  }

  watch(projectId, fetchMilestones, { immediate: true });

  return { milestones, fetchMilestones, createMilestone, updateMilestone, deleteMilestone };
}

/**
 * Read-only view over shared task + dependency state.
 * Used by TaskCard / KanbanBoard to compute blocked status without re-fetching.
 * Requires useTasks() + useDependencies() to have populated the shared state.
 */
export function useDependencyGraph() {
  const tasks = useState<Task[]>("tasks", () => []);
  const dependencies = useState<TaskDependency[]>("taskDependencies", () => []);

  const taskById = computed(() => new Map(tasks.value.map((t) => [t.id, t])));

  // outgoing: tasks this task waits on
  function getDependsOn(taskId: string) {
    return dependencies.value.filter((d) => d.task_id === taskId);
  }

  // incoming: tasks waiting on this task
  function getBlocks(taskId: string) {
    return dependencies.value.filter((d) => d.depends_on_task_id === taskId);
  }

  // BFS: adding `taskId` depends on `dependsOnTaskId` creates a cycle if
  // `dependsOnTaskId` already (transitively) depends on `taskId`.
  function wouldCreateCycle(taskId: string, dependsOnTaskId: string) {
    return graphWouldCreateCycle(dependencies.value, taskId, dependsOnTaskId);
  }

  function isTaskClosedById(taskId: string) {
    const t = taskById.value.get(taskId);
    return t ? isTaskClosed(t.status) : false;
  }

  // list of open prerequisite tasks currently blocking `taskId`
  function blockedBy(taskId: string): Task[] {
    return graphBlockedBy(dependencies.value, taskById.value, taskId);
  }

  function isBlocked(taskId: string) {
    return graphIsBlocked(dependencies.value, taskById.value, taskId);
  }

  return {
    tasks,
    dependencies,
    taskById,
    getDependsOn,
    getBlocks,
    wouldCreateCycle,
    isTaskClosedById,
    blockedBy,
    isBlocked,
  };
}

export type DependencyErrorCode = "self" | "closed" | "circular";

export function useDependencies(projectId: Ref<string | undefined>) {
  const supabase = useSupabaseClient();
  const { t } = useI18n();
  const graph = useDependencyGraph();
  const dependencies = graph.dependencies;

  async function fetchDependencies() {
    if (!projectId.value) {
      dependencies.value = [];
      return;
    }

    const { data: projectTasks } = await supabase
      .from("tasks")
      .select("id")
      .eq("project_id", projectId.value);

    const taskIds = (projectTasks ?? []).map((t) => t.id);
    if (taskIds.length === 0) {
      dependencies.value = [];
      return;
    }

    // every dep row has its task_id within the project, so one query covers both directions
    const { data } = await supabase
      .from("task_dependencies")
      .select("*")
      .in("task_id", taskIds);

    dependencies.value = (data ?? []) as TaskDependency[];
  }

  async function addDependency(taskId: string, dependsOnTaskId: string) {
    if (taskId === dependsOnTaskId) {
      return { error: t("tasks.depErrSelf"), code: "self" as DependencyErrorCode };
    }
    if (graph.isTaskClosedById(dependsOnTaskId)) {
      return { error: t("tasks.depErrClosed"), code: "closed" as DependencyErrorCode };
    }
    if (graph.wouldCreateCycle(taskId, dependsOnTaskId)) {
      return { error: t("tasks.depErrCircular"), code: "circular" as DependencyErrorCode };
    }

    const { error } = await supabase
      .from("task_dependencies")
      .insert({ task_id: taskId, depends_on_task_id: dependsOnTaskId });

    if (!error) await fetchDependencies();
    return { error: error?.message };
  }

  async function removeDependency(id: string) {
    await supabase.from("task_dependencies").delete().eq("id", id);
    await fetchDependencies();
  }

  watch(projectId, fetchDependencies, { immediate: true });

  return {
    dependencies,
    fetchDependencies,
    addDependency,
    removeDependency,
    getDependsOn: graph.getDependsOn,
    getBlocks: graph.getBlocks,
    wouldCreateCycle: graph.wouldCreateCycle,
    isTaskClosedById: graph.isTaskClosedById,
    blockedBy: graph.blockedBy,
    isBlocked: graph.isBlocked,
  };
}

/** Shared realtime channel — NotificationBell remounts between desktop/mobile layout. */
let notificationsChannel: ReturnType<ReturnType<typeof useSupabaseClient>["channel"]> | null =
  null;
let notificationsChannelUserId: string | null = null;

export function useNotifications() {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const notifications = useState<Notification[]>("notifications", () => []);
  const unreadCount = computed(() => notifications.value.filter((n) => !n.read).length);

  async function fetchNotifications() {
    if (!user.value) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.value.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("fetchNotifications failed:", error.message);
      return;
    }

    notifications.value = (data ?? []) as Notification[];
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    const n = notifications.value.find((n) => n.id === id);
    if (n) n.read = true;
  }

  async function markAllRead() {
    if (!user.value) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.value.id)
      .eq("read", false);
    notifications.value.forEach((n) => (n.read = true));
  }

  function teardownChannel() {
    if (notificationsChannel) {
      void supabase.removeChannel(notificationsChannel);
      notificationsChannel = null;
      notificationsChannelUserId = null;
    }
  }

  function subscribe() {
    const uid = user.value?.id;
    if (!uid) return;
    if (notificationsChannel && notificationsChannelUserId === uid) return;

    teardownChannel();
    notificationsChannelUserId = uid;

    notificationsChannel = supabase
      .channel(`notifications:${uid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const row = payload.new as Notification;
          if (row.user_id !== uid) return;
          if (notifications.value.some((n) => n.id === row.id)) return;
          notifications.value = [row, ...notifications.value].slice(0, 50);
        },
      )
      .subscribe();
  }

  watch(
    () => user.value?.id,
    (uid, prevUid) => {
      if (!uid) {
        if (prevUid) {
          teardownChannel();
          notifications.value = [];
        }
        return;
      }
      void fetchNotifications();
      subscribe();
    },
    { immediate: true },
  );

  return {
    notifications,
    unreadCount,
    fetchNotifications,
    markRead,
    markAllRead,
    subscribe,
  };
}

export function useAttachments(
  taskId: Ref<string | undefined>,
  subtaskId?: Ref<string | undefined | null>,
) {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const attachments = ref<Attachment[]>([]);

  async function fetchAttachments() {
    if (!taskId.value) return;

    let query = supabase
      .from("attachments")
      .select("*")
      .eq("task_id", taskId.value)
      .order("created_at", { ascending: false });

    const sid = subtaskId ? toValue(subtaskId) : null;
    if (sid) {
      query = query.eq("subtask_id", sid);
    } else {
      query = query.is("subtask_id", null);
    }

    const { data } = await query;
    attachments.value = (data ?? []) as Attachment[];
  }

  async function uploadFile(file: File) {
    if (!taskId.value || !user.value) return;

    const optimized = await optimizeUploadFile(file);
    const ext = optimized.name.split(".").pop() || "bin";
    const sid = subtaskId ? toValue(subtaskId) : null;
    const path = sid
      ? `${taskId.value}/subtasks/${sid}/${Date.now()}.${ext}`
      : `${taskId.value}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("attachments")
      .upload(path, optimized, {
        contentType: optimized.type || undefined,
      });

    if (uploadError) return { error: uploadError.message };

    const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);

    const { data, error } = await supabase
      .from("attachments")
      .insert({
        task_id: taskId.value,
        subtask_id: sid || null,
        uploaded_by: user.value.id,
        file_url: urlData.publicUrl,
        filename: optimized.name,
      })
      .select()
      .single();

    if (!error && data) attachments.value.unshift(data as Attachment);
    return { data, error: error?.message };
  }

  async function deleteAttachment(id: string, fileUrl: string) {
    const path = fileUrl.split("/attachments/")[1];
    if (path) await supabase.storage.from("attachments").remove([path]);
    await supabase.from("attachments").delete().eq("id", id);
    attachments.value = attachments.value.filter((a) => a.id !== id);
  }

  watch([taskId, () => (subtaskId ? toValue(subtaskId) : null)], fetchAttachments, {
    immediate: true,
  });

  return { attachments, fetchAttachments, uploadFile, deleteAttachment };
}
