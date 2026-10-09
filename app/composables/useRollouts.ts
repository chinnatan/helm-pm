import type { Rollout, RolloutStatus } from "~/types";
import { TASK_CLOSED_STATUSES } from "~/types";

const ROLLOUT_SELECT = `
  *,
  customers:customer_id(id, name, company),
  features:feature_id(id, name, color),
  commitments(*, commitment_reschedules(*))
`;

export const rolloutKey = (customerId: string, featureId: string) => `${customerId}:${featureId}`;

export function useRollouts() {
  const supabase = useSupabaseClient();
  const { workspace } = useWorkspace();

  const rollouts = useState<Rollout[]>("rollouts", () => []);
  /** จำนวน Task ที่ยังเปิดอยู่ ต่อ rollout key (customerId:featureId) */
  const openTaskCounts = useState<Record<string, number>>("rollout-open-counts", () => ({}));
  /** Task ที่ยังเปิดอยู่แต่ยังไม่ผูก Customer หรือ Feature (แสดง "ยังไม่ผูก") */
  const unlinkedTaskCount = useState("rollout-unlinked-count", () => 0);
  const loading = ref(false);

  async function fetchRollouts() {
    if (!workspace.value) return;
    loading.value = true;
    const workspaceId = workspace.value.id;

    const [rolloutRes, taskRes, unlinkedRes] = await Promise.all([
      supabase
        .from("rollouts")
        .select(ROLLOUT_SELECT)
        .eq("workspace_id", workspaceId)
        .order("created_at"),
      supabase
        .from("tasks")
        .select("customer_id, feature_id")
        .eq("workspace_id", workspaceId)
        .not("customer_id", "is", null)
        .not("feature_id", "is", null)
        .not("status", "in", `(${TASK_CLOSED_STATUSES.join(",")})`),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .or("customer_id.is.null,feature_id.is.null")
        .not("status", "in", `(${TASK_CLOSED_STATUSES.join(",")})`),
    ]);
    unlinkedTaskCount.value = unlinkedRes.count ?? 0;

    rollouts.value = (rolloutRes.data ?? []) as Rollout[];

    const counts: Record<string, number> = {};
    for (const t of taskRes.data ?? []) {
      const key = rolloutKey(t.customer_id!, t.feature_id!);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    openTaskCounts.value = counts;
    loading.value = false;
  }

  async function createRollout(customerId: string, featureId: string, status: RolloutStatus = "planned") {
    if (!workspace.value) return { data: null, error: "No workspace" };

    const { data, error } = await supabase
      .from("rollouts")
      .insert({
        workspace_id: workspace.value.id,
        customer_id: customerId,
        feature_id: featureId,
        status,
      })
      .select(ROLLOUT_SELECT)
      .single();

    if (!error && data) rollouts.value.push(data as Rollout);
    return { data: data as Rollout | null, error: error?.message };
  }

  async function setRolloutStatus(id: string, status: RolloutStatus) {
    const { error } = await supabase.from("rollouts").update({ status }).eq("id", id);
    if (!error) {
      const r = rollouts.value.find((x) => x.id === id);
      if (r) r.status = status;
    }
    return { error: error?.message };
  }

  async function deleteRollout(id: string) {
    const { error } = await supabase.from("rollouts").delete().eq("id", id);
    if (!error) rollouts.value = rollouts.value.filter((r) => r.id !== id);
    return { error: error?.message };
  }

  return {
    rollouts,
    openTaskCounts,
    unlinkedTaskCount,
    loading,
    fetchRollouts,
    createRollout,
    setRolloutStatus,
    deleteRollout,
  };
}
