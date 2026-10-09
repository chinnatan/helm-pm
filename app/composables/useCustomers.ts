import type { Customer, CustomerStatus, Task } from "~/types";
import { TASK_CLOSED_STATUSES } from "~/types";

/** Display as "company (name)", falling back to whichever is present. */
export function formatCustomerLabel(customer: {
  name?: string | null;
  company?: string | null;
}) {
  const name = customer.name?.trim() || "";
  const company = customer.company?.trim() || "";
  if (company && name) return `${company} (${name})`;
  return company || name;
}

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

    const counts: Record<string, number> = {};
    for (const c of customers.value) counts[c.id] = 0;

    const { data } = await supabase
      .from("tasks")
      .select("customer_id")
      .eq("workspace_id", workspace.value.id)
      .in("customer_id", customers.value.map((c) => c.id))
      .not("status", "in", `(${TASK_CLOSED_STATUSES.join(",")})`);

    for (const row of data ?? []) {
      if (row.customer_id && counts[row.customer_id] !== undefined) counts[row.customer_id]! += 1;
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
    const { data } = await supabase
      .from("tasks")
      .select(
        `*,
        profiles:assignee_id(id, email, full_name, avatar_url),
        features:feature_id(id, name, color)`,
      )
      .eq("customer_id", customerId)
      .not("status", "in", `(${TASK_CLOSED_STATUSES.join(",")})`)
      .order("updated_at", { ascending: false });

    return (data ?? []) as Task[];
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
