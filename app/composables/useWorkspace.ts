import type { Workspace, WorkspaceMember } from "~/types";

export function useWorkspace() {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();

  const workspace = useState<Workspace | null>("workspace", () => null);
  const members = useState<WorkspaceMember[]>("workspaceMembers", () => []);

  async function fetchWorkspace() {
    if (!user.value) return;

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id, workspaces(*)")
      .eq("user_id", user.value.id)
      .limit(1)
      .single();

    const row = membership as { workspaces?: Workspace } | null;
    if (row?.workspaces) {
      workspace.value = row.workspaces;
    }

    if (workspace.value) {
      await fetchMembers();
    }
  }

  async function fetchMembers() {
    if (!workspace.value) return;

    const { data } = await supabase
      .from("workspace_members")
      .select("*, profiles(*)")
      .eq("workspace_id", workspace.value.id)
      .order("created_at");

    members.value = (data ?? []) as WorkspaceMember[];
  }

  async function inviteMember(email: string, role: string = "member") {
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
    });

    if (!error) await fetchMembers();
    return { error: error?.message };
  }

  return {
    workspace,
    members,
    fetchWorkspace,
    fetchMembers,
    inviteMember,
  };
}
