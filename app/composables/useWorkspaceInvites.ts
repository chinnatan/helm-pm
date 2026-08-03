import type {
  InvitePreview,
  InviteType,
  JobRole,
  MemberRole,
  WorkspaceInvite,
} from "~/types";

export function useWorkspaceInvites() {
  const supabase = useSupabaseClient();
  const { workspace } = useWorkspace();

  const invites = useState<WorkspaceInvite[]>("workspaceInvites", () => []);
  const loading = ref(false);

  function inviteUrl(token: string) {
    if (import.meta.client) {
      return `${window.location.origin}/invite/${token}`;
    }
    const config = useRuntimeConfig();
    const base = (config.public.siteUrl as string | undefined) || "";
    return `${base}/invite/${token}`;
  }

  async function fetchInvites() {
    if (!workspace.value) return;
    loading.value = true;

    const { data } = await supabase
      .from("workspace_invites")
      .select("*")
      .eq("workspace_id", workspace.value.id)
      .order("created_at", { ascending: false });

    invites.value = (data ?? []) as WorkspaceInvite[];
    loading.value = false;
  }

  async function createInvite(options: {
    inviteType: InviteType;
    expiresAt: string;
    role?: MemberRole;
    jobRole?: JobRole | null;
    email?: string | null;
    maxUses?: number;
  }) {
    if (!workspace.value) return { data: null, error: "No workspace" };

    const { data, error } = await supabase.rpc("create_workspace_invite", {
      p_workspace_id: workspace.value.id,
      p_invite_type: options.inviteType,
      p_expires_at: options.expiresAt,
      p_role: options.role ?? "member",
      p_job_role: options.jobRole ?? null,
      p_email: options.email ?? null,
      p_max_uses: options.maxUses ?? 1,
    });

    if (error) return { data: null, error: error.message };

    const created = data as unknown as {
      id: string;
      token: string;
      expires_at: string;
      max_uses?: number;
    };
    await fetchInvites();
    return {
      data: {
        ...created,
        url: inviteUrl(created.token),
      },
      error: null,
    };
  }

  async function revokeInvite(id: string) {
    const { error } = await supabase.rpc("revoke_workspace_invite", {
      p_invite_id: id,
    });
    if (!error) await fetchInvites();
    return { error: error?.message ?? null };
  }

  async function previewInvite(token: string) {
    const { data, error } = await supabase.rpc("get_invite_preview", {
      p_token: token,
    });
    if (error) return { data: null, error: error.message };
    return { data: data as unknown as InvitePreview, error: null };
  }

  async function acceptInvite(token: string) {
    const { data, error } = await supabase.rpc("accept_workspace_invite", {
      p_token: token,
    });
    if (error) return { data: null, error: error.message };
    return { data: data as unknown as string, error: null };
  }

  function clearInvites() {
    invites.value = [];
  }

  return {
    invites,
    loading,
    inviteUrl,
    fetchInvites,
    createInvite,
    revokeInvite,
    previewInvite,
    acceptInvite,
    clearInvites,
  };
}
