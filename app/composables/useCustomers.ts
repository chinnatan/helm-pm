import type {
  Customer,
  CustomerStatus,
  Meeting,
  Requirement,
  RequirementStatus,
  Task,
} from "~/types";
import { isTaskClosed, TASK_CLOSED_STATUSES } from "~/types";

export function useCustomers() {
  const supabase = useSupabaseClient();
  const { workspace } = useWorkspace();

  const customers = useState<Customer[]>("customers", () => []);
  const openTaskCounts = useState<Record<string, number>>("customer-open-counts", () => ({}));
  const loading = ref(false);

  async function fetchCustomers() {
    if (!workspace.value) return;
    loading.value = true;

    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("workspace_id", workspace.value.id)
      .order("name");

    customers.value = (data ?? []) as Customer[];
    await fetchOpenTaskCounts();
    loading.value = false;
  }

  async function fetchOpenTaskCounts() {
    if (!workspace.value || customers.value.length === 0) {
      openTaskCounts.value = {};
      return;
    }

    const customerIds = customers.value.map((c) => c.id);
    const counts: Record<string, number> = {};
    for (const id of customerIds) counts[id] = 0;

    const { data: projects } = await supabase
      .from("projects")
      .select("id, customer_id")
      .eq("workspace_id", workspace.value.id)
      .not("customer_id", "is", null);

    const projectCustomer = new Map<string, string>();
    for (const p of projects ?? []) {
      if (p.customer_id) projectCustomer.set(p.id, p.customer_id);
    }

    const projectIds = [...projectCustomer.keys()];
    if (projectIds.length === 0 && customerIds.length === 0) {
      openTaskCounts.value = counts;
      return;
    }

    let query = supabase
      .from("tasks")
      .select("id, customer_id, project_id, status")
      .not("status", "in", `(${TASK_CLOSED_STATUSES.join(",")})`);

    if (projectIds.length > 0) {
      query = query.or(
        `customer_id.in.(${customerIds.join(",")}),project_id.in.(${projectIds.join(",")})`,
      );
    } else {
      query = query.in("customer_id", customerIds);
    }

    const { data: tasks } = await query;

    for (const task of tasks ?? []) {
      const cid =
        task.customer_id ||
        (task.project_id ? projectCustomer.get(task.project_id) : null);
      if (cid && counts[cid] !== undefined) counts[cid]! += 1;
    }

    openTaskCounts.value = counts;
  }

  async function getCustomer(id: string) {
    const cached = customers.value.find((c) => c.id === id);
    if (cached) return cached;

    const { data } = await supabase.from("customers").select("*").eq("id", id).single();
    return (data as Customer | null) ?? null;
  }

  async function createCustomer(input: {
    name: string;
    company?: string | null;
    contact_email?: string | null;
    notes?: string | null;
  }) {
    if (!workspace.value) return { data: null, error: "No workspace" };

    const { data, error } = await supabase
      .from("customers")
      .insert({
        workspace_id: workspace.value.id,
        name: input.name,
        company: input.company || null,
        contact_email: input.contact_email || null,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (!error && data) {
      customers.value.push(data as Customer);
      customers.value.sort((a, b) => a.name.localeCompare(b.name));
    }
    return { data: data as Customer | null, error: error?.message };
  }

  async function updateCustomer(
    id: string,
    updates: Partial<
      Pick<Customer, "name" | "company" | "contact_email" | "notes" | "status">
    >,
  ) {
    const { data, error } = await supabase
      .from("customers")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      const idx = customers.value.findIndex((c) => c.id === id);
      if (idx >= 0) customers.value[idx] = data as Customer;
    }
    return { data: data as Customer | null, error: error?.message };
  }

  async function archiveCustomer(id: string) {
    return updateCustomer(id, { status: "archived" as CustomerStatus });
  }

  async function restoreCustomer(id: string) {
    return updateCustomer(id, { status: "active" as CustomerStatus });
  }

  async function deleteCustomer(id: string) {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (!error) {
      customers.value = customers.value.filter((c) => c.id !== id);
      const { [id]: _, ...rest } = openTaskCounts.value;
      openTaskCounts.value = rest;
    }
    return { error: error?.message };
  }

  async function fetchOpenTasksForCustomer(customerId: string) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("customer_id", customerId);

    const projectIds = (projects ?? []).map((p) => p.id);

    let query = supabase
      .from("tasks")
      .select(
        `*,
        profiles:assignee_id(id, email, full_name, avatar_url),
        projects(id, name, color)`,
      )
      .not("status", "in", `(${TASK_CLOSED_STATUSES.join(",")})`)
      .order("updated_at", { ascending: false });

    if (projectIds.length > 0) {
      query = query.or(`customer_id.eq.${customerId},project_id.in.(${projectIds.join(",")})`);
    } else {
      query = query.eq("customer_id", customerId);
    }

    const { data } = await query;
    return ((data ?? []) as Task[]).filter((t) => !isTaskClosed(t.status));
  }

  return {
    customers,
    openTaskCounts,
    loading,
    fetchCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    archiveCustomer,
    restoreCustomer,
    deleteCustomer,
    fetchOpenTasksForCustomer,
    fetchOpenTaskCounts,
  };
}

export function useMeetings(customerId: Ref<string | undefined>) {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const meetings = ref<Meeting[]>([]);

  async function fetchMeetings() {
    if (!customerId.value) return;

    const { data } = await supabase
      .from("meetings")
      .select("*")
      .eq("customer_id", customerId.value)
      .order("met_at", { ascending: false });

    meetings.value = (data ?? []) as Meeting[];
  }

  async function createMeeting(input: {
    title: string;
    met_at: string;
    summary?: string | null;
  }) {
    if (!customerId.value) return { data: null, error: "No customer" };

    const { data, error } = await supabase
      .from("meetings")
      .insert({
        customer_id: customerId.value,
        title: input.title,
        met_at: input.met_at,
        summary: input.summary || null,
        created_by: user.value?.id,
      })
      .select()
      .single();

    if (!error && data) {
      meetings.value.unshift(data as Meeting);
    }
    return { data: data as Meeting | null, error: error?.message };
  }

  async function updateMeeting(
    id: string,
    updates: Partial<Pick<Meeting, "title" | "met_at" | "summary">>,
  ) {
    const { data, error } = await supabase
      .from("meetings")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      const idx = meetings.value.findIndex((m) => m.id === id);
      if (idx >= 0) meetings.value[idx] = data as Meeting;
    }
    return { data: data as Meeting | null, error: error?.message };
  }

  async function deleteMeeting(id: string) {
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    if (!error) meetings.value = meetings.value.filter((m) => m.id !== id);
    return { error: error?.message };
  }

  watch(customerId, fetchMeetings, { immediate: true });

  return { meetings, fetchMeetings, createMeeting, updateMeeting, deleteMeeting };
}

export function useRequirements(customerId: Ref<string | undefined>) {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const requirements = ref<Requirement[]>([]);

  async function fetchRequirements() {
    if (!customerId.value) return;

    const { data } = await supabase
      .from("requirements")
      .select("*, meetings:meeting_id(id, title, met_at)")
      .eq("customer_id", customerId.value)
      .order("created_at", { ascending: false });

    requirements.value = (data ?? []) as Requirement[];
  }

  async function createRequirement(input: {
    title: string;
    description?: string | null;
    meeting_id?: string | null;
    status?: RequirementStatus;
  }) {
    if (!customerId.value) return { data: null, error: "No customer" };

    const { data, error } = await supabase
      .from("requirements")
      .insert({
        customer_id: customerId.value,
        title: input.title,
        description: input.description || null,
        meeting_id: input.meeting_id || null,
        status: input.status ?? "open",
      })
      .select("*, meetings:meeting_id(id, title, met_at)")
      .single();

    if (!error && data) {
      requirements.value.unshift(data as Requirement);
    }
    return { data: data as Requirement | null, error: error?.message };
  }

  async function updateRequirement(
    id: string,
    updates: Partial<
      Pick<Requirement, "title" | "description" | "status" | "meeting_id" | "task_id">
    >,
  ) {
    const { data, error } = await supabase
      .from("requirements")
      .update(updates)
      .eq("id", id)
      .select("*, meetings:meeting_id(id, title, met_at)")
      .single();

    if (!error && data) {
      const idx = requirements.value.findIndex((r) => r.id === id);
      if (idx >= 0) requirements.value[idx] = data as Requirement;
    }
    return { data: data as Requirement | null, error: error?.message };
  }

  async function deleteRequirement(id: string) {
    const { error } = await supabase.from("requirements").delete().eq("id", id);
    if (!error) requirements.value = requirements.value.filter((r) => r.id !== id);
    return { error: error?.message };
  }

  async function createTaskFromRequirement(
    requirementId: string,
    projectId: string,
  ) {
    const req = requirements.value.find((r) => r.id === requirementId);
    if (!req || !customerId.value) return { data: null, error: "Requirement not found" };

    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        project_id: projectId,
        title: req.title,
        description: req.description,
        customer_id: customerId.value,
        created_by: user.value?.id,
        status: "todo",
        priority: "medium",
      })
      .select()
      .single();

    if (error || !task) return { data: null, error: error?.message };

    await updateRequirement(requirementId, {
      task_id: task.id,
      status: "in_progress",
    });

    return { data: task, error: undefined };
  }

  watch(customerId, fetchRequirements, { immediate: true });

  return {
    requirements,
    fetchRequirements,
    createRequirement,
    updateRequirement,
    deleteRequirement,
    createTaskFromRequirement,
  };
}
