import type { CustomerShareLink } from "~/types";

export function useShareLinks(customerId: Ref<string>) {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const { workspace } = useWorkspace();
  const links = ref<CustomerShareLink[]>([]);

  const isActive = (l: CustomerShareLink) => !l.revoked_at && new Date(l.expires_at) > new Date();

  async function fetchLinks() {
    const { data } = await supabase
      .from("customer_share_links")
      .select("*")
      .eq("customer_id", customerId.value)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    links.value = (data ?? []) as CustomerShareLink[];
  }

  async function createLink(days: number) {
    if (!workspace.value) return { error: "No workspace" };
    const expires = new Date(Date.now() + days * 86_400_000).toISOString();
    const { error } = await supabase.from("customer_share_links").insert({
      workspace_id: workspace.value.id,
      customer_id: customerId.value,
      expires_at: expires,
      created_by: user.value?.id ?? null,
    });
    if (!error) await fetchLinks();
    return { error: error?.message };
  }

  async function revokeLink(id: string) {
    const { error } = await supabase
      .from("customer_share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) await fetchLinks();
    return { error: error?.message };
  }

  const linkUrl = (token: string) => `${window.location.origin}/share/${token}`;

  return { links, isActive, fetchLinks, createLink, revokeLink, linkUrl };
}
