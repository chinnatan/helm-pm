import type { CommitmentTargetStatus } from "~/types";

export function useCommitments() {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const { fetchRollouts } = useRollouts();

  async function createCommitment(
    rolloutId: string,
    month: string,
    targetStatus: CommitmentTargetStatus = "production",
  ) {
    const { data, error } = await supabase
      .from("commitments")
      .insert({ rollout_id: rolloutId, month: toMonthStart(month), target_status: targetStatus })
      .select()
      .single();
    if (!error) await fetchRollouts();
    return { data, error: error?.message };
  }

  /** เลื่อนเดือน: บังคับเหตุผล แล้วเก็บประวัติ (เดือนเดิม → ใหม่) */
  async function rescheduleCommitment(commitmentId: string, fromMonth: string, toMonth: string, reason: string) {
    const to = toMonthStart(toMonth);
    const trimmed = reason.trim();
    if (!trimmed) return { error: "Reason is required" };
    if (to === fromMonth) return { error: "Same month" };

    // ponytail: สองคำสั่งแยกกัน ไม่ใช่ transaction — ถ้า insert ประวัติล้มเหลว จะย้อนเดือนกลับ; ย้ายเป็น RPC ถ้าต้อง atomic จริง
    const { error: updateError } = await supabase
      .from("commitments")
      .update({ month: to })
      .eq("id", commitmentId);
    if (updateError) return { error: updateError.message };

    const { error: logError } = await supabase.from("commitment_reschedules").insert({
      commitment_id: commitmentId,
      from_month: fromMonth,
      to_month: to,
      reason: trimmed,
      created_by: user.value?.id ?? null,
    });
    if (logError) {
      await supabase.from("commitments").update({ month: fromMonth }).eq("id", commitmentId);
      return { error: logError.message };
    }

    await fetchRollouts();
    return { error: undefined };
  }

  async function deleteCommitment(id: string) {
    const { error } = await supabase.from("commitments").delete().eq("id", id);
    if (!error) await fetchRollouts();
    return { error: error?.message };
  }

  return { createCommitment, rescheduleCommitment, deleteCommitment };
}
