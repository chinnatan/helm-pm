import type { Comment, Milestone, TaskDependency, Notification, Attachment } from "~/types";

export function useComments(taskId: Ref<string | undefined>) {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const comments = ref<Comment[]>([]);

  async function fetchComments() {
    if (!taskId.value) return;

    const { data } = await supabase
      .from("comments")
      .select("*, profiles(id, email, full_name, avatar_url)")
      .eq("task_id", taskId.value)
      .order("created_at");

    comments.value = (data ?? []) as Comment[];
  }

  async function addComment(content: string) {
    if (!taskId.value || !user.value) return;

    const { data, error } = await supabase
      .from("comments")
      .insert({ task_id: taskId.value, user_id: user.value.id, content })
      .select("*, profiles(id, email, full_name, avatar_url)")
      .single();

    if (!error && data) comments.value.push(data as Comment);

    // Create notification for assignee mentions
    const mentions = content.match(/@(\S+)/g);
    if (mentions) {
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
          });
        }
      }
    }

    return { error: error?.message };
  }

  watch(taskId, fetchComments, { immediate: true });

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

  async function createMilestone(title: string, startDate: string, dueDate: string) {
    if (!projectId.value) return;

    const { data, error } = await supabase
      .from("milestones")
      .insert({
        project_id: projectId.value,
        title,
        start_date: startDate,
        due_date: dueDate,
        date: dueDate,
      })
      .select()
      .single();

    if (!error && data) milestones.value.push(data as Milestone);
    return { data, error: error?.message };
  }

  async function updateMilestone(
    id: string,
    updates: { title?: string; start_date?: string; due_date?: string },
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

export function useDependencies(projectId: Ref<string | undefined>) {
  const supabase = useSupabaseClient();
  const dependencies = ref<TaskDependency[]>([]);

  async function fetchDependencies() {
    if (!projectId.value) return;

    const { data: projectTasks } = await supabase
      .from("tasks")
      .select("id")
      .eq("project_id", projectId.value);

    const taskIds = (projectTasks ?? []).map((t) => t.id);
    if (taskIds.length === 0) return;

    const { data } = await supabase
      .from("task_dependencies")
      .select("*")
      .in("task_id", taskIds);

    dependencies.value = (data ?? []) as TaskDependency[];
  }

  async function addDependency(taskId: string, dependsOnTaskId: string) {
    if (taskId === dependsOnTaskId) {
      return { error: "A task cannot depend on itself" };
    }

    // Check for circular dependency
    const { data: existing } = await supabase
      .from("task_dependencies")
      .select("*")
      .eq("task_id", dependsOnTaskId)
      .eq("depends_on_task_id", taskId);

    if (existing && existing.length > 0) {
      return { error: "Circular dependency detected" };
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

  return { dependencies, fetchDependencies, addDependency, removeDependency };
}

/** Shared realtime channel — NotificationBell remounts between desktop/mobile layout. */
let notificationsChannel: ReturnType<ReturnType<typeof useSupabaseClient>["channel"]> | null =
  null;

export function useNotifications() {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const notifications = useState<Notification[]>("notifications", () => []);
  const unreadCount = computed(() => notifications.value.filter((n) => !n.read).length);

  async function fetchNotifications() {
    if (!user.value) return;

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.value.id)
      .order("created_at", { ascending: false })
      .limit(50);

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

  function subscribe() {
    if (!user.value || notificationsChannel) return;

    const uid = user.value.id;

    // ไม่ใส่ filter บน user_id — Realtime จำกัด filter ตาม column privilege / replica identity
    // อาศัย RLS + กรองฝั่ง client แทน
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
          const row = payload.new as { user_id?: string };
          if (row.user_id === uid) fetchNotifications();
        },
      )
      .subscribe();
  }

  return {
    notifications,
    unreadCount,
    fetchNotifications,
    markRead,
    markAllRead,
    subscribe,
  };
}

export function useAttachments(taskId: Ref<string | undefined>) {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const attachments = ref<Attachment[]>([]);

  async function fetchAttachments() {
    if (!taskId.value) return;

    const { data } = await supabase
      .from("attachments")
      .select("*")
      .eq("task_id", taskId.value)
      .order("created_at", { ascending: false });

    attachments.value = (data ?? []) as Attachment[];
  }

  async function uploadFile(file: File) {
    if (!taskId.value || !user.value) return;

    const ext = file.name.split(".").pop();
    const path = `${taskId.value}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("attachments")
      .upload(path, file);

    if (uploadError) return { error: uploadError.message };

    const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);

    const { data, error } = await supabase
      .from("attachments")
      .insert({
        task_id: taskId.value,
        uploaded_by: user.value.id,
        file_url: urlData.publicUrl,
        filename: file.name,
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

  watch(taskId, fetchAttachments, { immediate: true });

  return { attachments, fetchAttachments, uploadFile, deleteAttachment };
}
