/** จำนวน Task สถานะ inbox ของ workspace (badge บนเมนู Tasks) */
export function useInboxCount() {
  const supabase = useSupabaseClient();
  const { workspace } = useWorkspace();
  const count = useState("inbox-count", () => 0);

  async function fetchInboxCount() {
    if (!workspace.value) return;
    const { count: n } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.value.id)
      .eq("status", "inbox");
    count.value = n ?? 0;
  }

  return { inboxCount: count, fetchInboxCount };
}
