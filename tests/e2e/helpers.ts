import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Page } from "@playwright/test";

export const AUTH_DIR = "tests/e2e/.auth";
export const STORAGE_STATE = `${AUTH_DIR}/user.json`;
export const CONTEXT_FILE = `${AUTH_DIR}/context.json`;
export const E2E_EMAIL = "e2e@helm.local";
export const E2E_PASSWORD = "E2ePass!12345";
export const E2E_WORKSPACE = "E2E Workspace";
export const E2E_PROJECT = "E2E Project";

export function supabaseLocal() {
  const { E2E_SUPABASE_URL, E2E_SUPABASE_KEY, E2E_SUPABASE_SECRET_KEY } = process.env;
  if (E2E_SUPABASE_URL && E2E_SUPABASE_KEY && E2E_SUPABASE_SECRET_KEY) {
    return { url: E2E_SUPABASE_URL, key: E2E_SUPABASE_KEY, secret: E2E_SUPABASE_SECRET_KEY };
  }
  let status: {
    API_URL: string;
    PUBLISHABLE_KEY?: string;
    ANON_KEY?: string;
    SECRET_KEY?: string;
    SERVICE_ROLE_KEY?: string;
  };
  try {
    status = JSON.parse(
      execSync("supabase status -o json", {
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf8",
      }),
    );
  } catch {
    throw new Error(
      "Supabase local ไม่ทำงาน — รัน `supabase start` ก่อน (หรือ override ด้วย E2E_SUPABASE_URL / E2E_SUPABASE_KEY / E2E_SUPABASE_SECRET_KEY)",
    );
  }
  return {
    url: status.API_URL,
    key: status.PUBLISHABLE_KEY ?? status.ANON_KEY!,
    secret: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY!,
  };
}

const sb = supabaseLocal();

async function json(res: Response) {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`);
  return body;
}

async function signIn(): Promise<string | null> {
  const res = await fetch(`${sb.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: sb.key, "content-type": "application/json" },
    body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
  });
  if (!res.ok) return null;
  return ((await res.json()) as { access_token: string }).access_token;
}

export async function ensureUser(): Promise<string> {
  const existing = await signIn();
  if (existing) return existing;
  await json(
    await fetch(`${sb.url}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: sb.secret,
        authorization: `Bearer ${sb.secret}`,
        "content-type": "application/json",
      },
      // data = raw_user_meta_data เดิมกับที่ signUp UI ส่ง → trigger สร้าง profile+workspace เท่ากัน
      body: JSON.stringify({
        email: E2E_EMAIL,
        password: E2E_PASSWORD,
        email_confirm: true,
        data: {
          first_name: "E2E",
          last_name: "Runner",
          full_name: "E2E Runner",
          workspace_name: E2E_WORKSPACE,
        },
      }),
    }),
  );
  const token = await signIn();
  if (!token) throw new Error("สร้าง user แล้วแต่ login ไม่ได้");
  return token;
}

async function rest<T = any>(token: string, path: string, init?: RequestInit): Promise<T> {
  return json(
    await fetch(`${sb.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: sb.key,
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    }),
  ) as Promise<T>;
}

export async function ensureProject(token: string): Promise<string> {
  // RLS จำกัด workspaces ให้เหลือเฉพาะที่ member อยู่ — ตัวแรก = ของ user นี้จาก trigger
  // (หมายเหตุ: gotrue admin API ไม่เก็บ `data` ลง raw_user_meta_data → workspace ได้ชื่อ default "My Workspace")
  const ws = await rest<{ id: string }[]>(token, "workspaces?select=id&order=created_at.asc&limit=1");
  const workspace = ws[0];
  if (!workspace) throw new Error("ไม่พบ workspace ของ user — trigger สร้าง workspace ทำงานหรือไม่?");
  const found = await rest<{ id: string }[]>(
    token,
    `projects?select=id&workspace_id=eq.${workspace.id}&name=eq.${encodeURIComponent(E2E_PROJECT)}&limit=1`,
  );
  if (found.length && found[0]) return found[0].id;
  const [project] = await rest<{ id: string }[]>(token, "projects", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ workspace_id: workspace.id, name: E2E_PROJECT }),
  });
  if (!project) throw new Error("สร้าง project ไม่สำเร็จ");
  return project.id;
}

export async function createTask(token: string, projectId: string, title: string): Promise<string> {
  const [task] = await rest<{ id: string }[]>(token, "tasks", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ project_id: projectId, title }),
  });
  if (!task) throw new Error("สร้าง task ไม่สำเร็จ");
  return task.id;
}

export async function deleteTask(token: string, id: string): Promise<void> {
  await fetch(`${sb.url}/rest/v1/tasks?id=eq.${id}`, {
    method: "DELETE",
    headers: { apikey: sb.key, authorization: `Bearer ${token}` },
  });
}

export interface E2EContext {
  projectId: string;
  accessToken: string;
}

// vite cold dep-optimizer สามารถ trigger full-reload ตอน navigate หลัง login (dev-only, cache แยก e2e)
// → retry ทั้ง sequence: ครั้ง 2 cache อุ่นแล้ว

export function taskCard(page: Page, title: string) {
  return page
    .getByTestId("task-card")
    .filter({ has: page.locator('[data-testid="task-card-title"]', { hasText: title }) });
}

export async function fillLoginForm(page: Page, email: string, password: string): Promise<void> {
  for (let i = 0; ; i++) {
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.locator('input[type="password"]').fill(password);
    const stillThere =
      (await page.getByPlaceholder("you@example.com").inputValue({ timeout: 2_000 })) === email;
    if (stillThere || i >= 3) return;
    await page.waitForLoadState("networkidle");
  }
}

export async function loginViaUI(page: Page, email: string, password: string, attempts = 3): Promise<void> {
  for (let i = 1; ; i++) {
    await page.goto("/login", { waitUntil: "networkidle" });
    await fillLoginForm(page, email, password);
    await page.locator('button[type="submit"]').click();
    try {
      await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 10_000 });
      return;
    } catch (err) {
      if (i >= attempts) throw err;
    }
  }
}

export function saveContext(ctx: E2EContext): void {
  mkdirSync(dirname(CONTEXT_FILE), { recursive: true });
  writeFileSync(CONTEXT_FILE, JSON.stringify(ctx));
}

export function readContext(): E2EContext {
  return JSON.parse(readFileSync(CONTEXT_FILE, "utf8")) as E2EContext;
}
