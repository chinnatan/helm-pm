import type { Feature } from "~/types";
import { FEATURE_COLORS } from "~/types";

export function useFeatures() {
  const supabase = useSupabaseClient();
  const { workspace } = useWorkspace();

  const features = useState<Feature[]>("features", () => []);
  const loading = ref(false);

  async function fetchFeatures() {
    if (!workspace.value) return;
    loading.value = true;

    const { data } = await supabase
      .from("features")
      .select("*")
      .eq("workspace_id", workspace.value.id)
      .is("archived_at", null)
      .order("sort_order")
      .order("name");

    features.value = (data ?? []) as Feature[];
    loading.value = false;
  }

  async function createFeature(name: string, color?: string) {
    if (!workspace.value) return { data: null, error: "No workspace" };

    const maxSort = features.value.reduce((max, f) => Math.max(max, f.sort_order), -1);
    const { data, error } = await supabase
      .from("features")
      .insert({
        workspace_id: workspace.value.id,
        name,
        color: color ?? FEATURE_COLORS[features.value.length % FEATURE_COLORS.length],
        sort_order: maxSort + 1,
      })
      .select()
      .single();

    if (!error && data) features.value.push(data as Feature);
    return { data: data as Feature | null, error: error?.message };
  }

  async function updateFeature(id: string, updates: Partial<Pick<Feature, "name" | "color">>) {
    const { data, error } = await supabase
      .from("features")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      const idx = features.value.findIndex((f) => f.id === id);
      if (idx >= 0) features.value[idx] = data as Feature;
    }
    return { data: data as Feature | null, error: error?.message };
  }

  async function archiveFeature(id: string) {
    const { error } = await supabase
      .from("features")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) features.value = features.value.filter((f) => f.id !== id);
    return { error: error?.message };
  }

  async function reorderFeatures(orderedIds: string[]) {
    const byId = new Map(features.value.map((f) => [f.id, f]));
    features.value = orderedIds
      .map((id, i) => {
        const f = byId.get(id);
        if (f) f.sort_order = i;
        return f;
      })
      .filter(Boolean) as Feature[];

    const results = await Promise.all(
      orderedIds.map((id, i) => supabase.from("features").update({ sort_order: i }).eq("id", id)),
    );
    return { error: results.find((r) => r.error)?.error?.message };
  }

  return {
    features,
    loading,
    fetchFeatures,
    createFeature,
    updateFeature,
    archiveFeature,
    reorderFeatures,
  };
}
