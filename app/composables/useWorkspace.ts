import type {
  Workspace,
  WorkspaceMember,
  WorkspaceMembership,
  JobRole,
  MemberRole,
} from "~/types";

export function useWorkspace() {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();

  const workspace = useState<Workspace | null>("workspace", () => null);
  const workspaces = useState<WorkspaceMembership[]>("workspaces", () => []);
  const members = useState<WorkspaceMember[]>("workspaceMembers", () => []);
  const loading = useState("workspaceLoading", () => false);

  const myMembership = computed(() =>
    members.value.find((m) => m.user_id === user.value?.id) ?? null,
  );

  const canManageMembers = computed(() => {
    const role = myMembership.value?.role;
    return role === "admin" || role === "manager";
  });

  const isWorkspaceAdmin = computed(() => myMembership.value?.role === "admin");

  function clearWorkspaceCaches() {
    members.value = [];
    const projects = useState("projects", () => [] as unknown[]);
    projects.value = [];
    const customers = useState("customers", () => [] as unknown[]);
    customers.value = [];
    const openTaskCounts = useState<Record<string, number>>(
      "customer-open-counts",
      () => ({}),
    );
    openTaskCounts.value = {};
    const plannerTasks = useState("plannerTasks", () => [] as unknown[]);
    plannerTasks.value = [];
    const workspaceInvites = useState("workspaceInvites", () => [] as unknown[]);
    workspaceInvites.value = [];
    const auditLogEntries = useState("auditLogEntries", () => [] as unknown[]);
    auditLogEntries.value = [];
  }

  async function fetchWorkspaces() {
    if (!user.value) return;

    const { data } = await supabase
      .from("workspace_members")
      .select("id, role, workspace_id, workspaces(*)")
      .eq("user_id", user.value.id)
      .order("created_at", { ascending: true });

    workspaces.value = ((data ?? []) as unknown as Array<{
      id: string;
      role: MemberRole;
      workspaces?: Workspace | Workspace[] | null;
    }>)
      .map((r) => {
        const ws = Array.isArray(r.workspaces) ? r.workspaces[0] : r.workspaces;
        if (!ws) return null;
        return {
          membershipId: r.id,
          role: r.role,
          workspace: ws,
        } satisfies WorkspaceMembership;
      })
      .filter((m): m is WorkspaceMembership => m !== null);
  }

  async function fetchMembers() {
    if (!workspace.value) return;

    const { data } = await supabase
      .from("workspace_members")
      .select("*, profiles(*)")
      .eq("workspace_id", workspace.value.id)
      .order("created_at");

    members.value = (data ?? []) as unknown as WorkspaceMember[];
  }

  async function resolveActiveWorkspaceId(): Promise<string | null> {
    if (!user.value) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("active_workspace_id")
      .eq("id", user.value.id)
      .maybeSingle();

    const activeId = profile?.active_workspace_id ?? null;
    if (activeId && workspaces.value.some((w) => w.workspace.id === activeId)) {
      return activeId;
    }

    const first = workspaces.value[0]?.workspace.id ?? null;
    if (first) {
      await supabase.rpc("set_active_workspace", { ws_id: first });
    }
    return first;
  }

  async function fetchWorkspace() {
    if (!user.value) return;
    loading.value = true;

    try {
      await fetchWorkspaces();
      const activeId = await resolveActiveWorkspaceId();
      const selected =
        workspaces.value.find((w) => w.workspace.id === activeId)?.workspace ??
        null;
      workspace.value = selected;

      if (workspace.value) {
        await fetchMembers();
      } else {
        members.value = [];
      }
    } finally {
      loading.value = false;
    }
  }

  async function setActiveWorkspace(id: string) {
    if (!user.value) return { error: "Not authenticated" };
    if (workspace.value?.id === id) return { error: null };

    const { error } = await supabase.rpc("set_active_workspace", { ws_id: id });
    if (error) return { error: error.message };

    clearWorkspaceCaches();

    const selected =
      workspaces.value.find((w) => w.workspace.id === id)?.workspace ?? null;
    workspace.value = selected;

    if (workspace.value) {
      await fetchMembers();
    }

    return { error: null };
  }

  async function createWorkspace(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return { data: null, error: "Workspace name is required" };

    const { data, error } = await supabase.rpc("create_workspace", {
      ws_name: trimmed,
    });

    if (error) return { data: null, error: error.message };

    clearWorkspaceCaches();

    await fetchWorkspaces();
    const wsId = data as string;
    const selected =
      workspaces.value.find((w) => w.workspace.id === wsId)?.workspace ?? null;
    workspace.value = selected;

    if (workspace.value) {
      await fetchMembers();
    }

    return { data: selected, error: null };
  }

  async function inviteMember(
    email: string,
    role: string = "member",
    jobRole: JobRole | null = null,
  ) {
    const { t } = useI18n();

    if (!workspace.value) return { error: t("team.noWorkspace") };

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (!profile) {
      return { error: t("team.userNotFound") };
    }

    const { error } = await supabase.from("workspace_members").insert({
      workspace_id: workspace.value.id,
      user_id: profile.id,
      role,
      job_role: jobRole,
    });

    if (!error) await fetchMembers();
    return { error: error?.message };
  }

  async function updateMember(
    id: string,
    updates: { role?: MemberRole; job_role?: JobRole | null },
  ) {
    const { data, error } = await supabase
      .from("workspace_members")
      .update(updates)
      .eq("id", id)
      .select("*, profiles(*)")
      .single();

    if (!error && data) {
      const idx = members.value.findIndex((m) => m.id === id);
      if (idx >= 0) members.value[idx] = data as unknown as WorkspaceMember;
    }
    return { error: error?.message };
  }

  return {
    workspace,
    workspaces,
    members,
    loading,
    myMembership,
    canManageMembers,
    isWorkspaceAdmin,
    fetchWorkspace,
    fetchWorkspaces,
    fetchMembers,
    setActiveWorkspace,
    createWorkspace,
    inviteMember,
    updateMember,
    clearWorkspaceCaches,
  };
}
