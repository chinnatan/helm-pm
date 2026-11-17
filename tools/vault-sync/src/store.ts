import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { HelmTask, Store } from "./sync";

function must<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) throw Object.assign(new Error(res.error.message), { code: res.error.code });
  return (res.data ?? []) as T;
}

/** Every query is filtered by workspaceId (task_dependencies has no workspace_id: filtered through workspace task ids). */
export function supabaseStore(client: SupabaseClient, ws: string): Store {
  const tasks = () => client.from("tasks");
  return {
    async customers() {
      return must(await client.from("customers").select("id,name").eq("workspace_id", ws));
    },
    async features() {
      return must(await client.from("features").select("id,name").eq("workspace_id", ws));
    },
    async members() {
      const rows = must(
        await client.from("workspace_members").select("user_id, profiles(first_name,last_name,full_name,email)").eq("workspace_id", ws),
      ) as unknown as { user_id: string; profiles: { first_name: string | null; last_name: string | null; full_name: string | null; email: string } | null }[];
      return rows.map((m) => {
        const p = m.profiles;
        const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() || p?.full_name || p?.email || "";
        return { user_id: m.user_id, name };
      });
    },
    async tasks() {
      return must(
        await tasks().select("id,external_key,title,status,due_date,assignee_id,customer_id,feature_id").eq("workspace_id", ws).not("external_key", "is", null),
      ) as HelmTask[];
    },
    async deps(ids) {
      if (!ids.length) return [];
      return must(await client.from("task_dependencies").select("task_id,depends_on_task_id").in("task_id", ids));
    },
    async createTask(row) {
      const d = must(await tasks().insert({ ...row, workspace_id: ws }).select("id").single()) as unknown as { id: string };
      return d.id;
    },
    async updateTask(id, patch) {
      must(await tasks().update(patch).eq("id", id).eq("workspace_id", ws).select("id"));
    },
    async deleteDeps(taskId) {
      must(await client.from("task_dependencies").delete().eq("task_id", taskId).select("id"));
    },
    async insertDep(taskId, dependsOnId) {
      must(await client.from("task_dependencies").insert({ task_id: taskId, depends_on_task_id: dependsOnId }).select("id"));
    },
  };
}

export const makeClient = (url: string, key: string) => createClient(url, key, { auth: { persistSession: false } });
