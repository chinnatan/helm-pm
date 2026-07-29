import type { Env } from "./env";

export function supabaseHeaders(env: Env, extra: Record<string, string> = {}) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function supabaseGet<T>(
  env: Env,
  path: string,
): Promise<{ data: T | null; error?: string }> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: supabaseHeaders(env, { Accept: "application/json" }),
  });
  if (!res.ok) {
    return { data: null, error: await res.text() };
  }
  const data = (await res.json()) as T;
  return { data };
}

export async function supabasePatch(
  env: Env,
  path: string,
  body: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: supabaseHeaders(env, { Prefer: "return=minimal" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, error: await res.text() };
  return { ok: true };
}

export async function supabasePost(
  env: Env,
  path: string,
  body: unknown,
  prefer = "return=minimal",
): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: supabaseHeaders(env, { Prefer: prefer }),
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, error: await res.text() };
  if (prefer.includes("representation")) {
    return { ok: true, data: await res.json() };
  }
  return { ok: true };
}

export async function supabaseRpc(
  env: Env,
  fn: string,
  args: Record<string, unknown> = {},
): Promise<{ data: unknown; error?: string }> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: supabaseHeaders(env),
    body: JSON.stringify(args),
  });
  if (!res.ok) return { data: null, error: await res.text() };
  const data = await res.json();
  return { data };
}
