import type { AuditEntityType, AuditLogEntry } from "~/types";

export function useAuditLog() {
  const supabase = useSupabaseClient();
  const { workspace } = useWorkspace();

  const entries = useState<AuditLogEntry[]>("auditLogEntries", () => []);
  const loading = ref(false);

  async function fetchAuditLog(options?: {
    entityType?: AuditEntityType | "all";
    from?: string | null;
    to?: string | null;
    limit?: number;
  }) {
    if (!workspace.value) {
      entries.value = [];
      return;
    }

    loading.value = true;

    let query = supabase
      .from("audit_log")
      .select("*, profiles:actor_id(id, email, full_name, avatar_url)")
      .eq("workspace_id", workspace.value.id)
      .order("created_at", { ascending: false })
      .limit(options?.limit ?? 100);

    if (options?.entityType && options.entityType !== "all") {
      query = query.eq("entity_type", options.entityType);
    }
    if (options?.from) {
      query = query.gte("created_at", options.from);
    }
    if (options?.to) {
      query = query.lte("created_at", options.to);
    }

    const { data } = await query;
    entries.value = (data ?? []) as unknown as AuditLogEntry[];
    loading.value = false;
  }

  function clearAuditLog() {
    entries.value = [];
  }

  return {
    entries,
    loading,
    fetchAuditLog,
    clearAuditLog,
  };
}
