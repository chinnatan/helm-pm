import type { Project } from "~/types";
import { PROJECT_COLORS } from "~/types";

export function useProjects() {
  const supabase = useSupabaseClient();
  const { workspace } = useWorkspace();

  const projects = useState<Project[]>("projects", () => []);
  const loading = ref(false);

  async function fetchProjects() {
    if (!workspace.value) return;
    loading.value = true;

    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("workspace_id", workspace.value.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    projects.value = (data ?? []) as Project[];
    loading.value = false;
  }

  async function createProject(name: string, description?: string) {
    if (!workspace.value) return null;

    const color = PROJECT_COLORS[projects.value.length % PROJECT_COLORS.length];

    const { data, error } = await supabase
      .from("projects")
      .insert({
        workspace_id: workspace.value.id,
        name,
        description: description || null,
        color,
      })
      .select()
      .single();

    if (!error && data) {
      projects.value.unshift(data as Project);
    }
    return { data, error: error?.message };
  }

  async function updateProject(id: string, updates: Partial<Project>) {
    const { data, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      const idx = projects.value.findIndex((p) => p.id === id);
      if (idx >= 0) projects.value[idx] = data as Project;
    }
    return { data, error: error?.message };
  }

  async function archiveProject(id: string) {
    return updateProject(id, { archived_at: new Date().toISOString() } as Partial<Project>);
  }

  function getProject(id: string) {
    return projects.value.find((p) => p.id === id) ?? null;
  }

  return {
    projects,
    loading,
    fetchProjects,
    createProject,
    updateProject,
    archiveProject,
    getProject,
  };
}
