import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parseDependsOn, parseFrontmatter, setFrontmatterValues } from "./frontmatter";
import { toHelmStatus, toVaultStatus } from "./status";

export type HelmTask = {
  id: string;
  external_key: string;
  title: string;
  status: string;
  due_date: string | null;
  assignee_id: string | null;
  customer_id: string | null;
  feature_id: string | null;
};
/** Injected data access. Every method is already scoped to one workspace (see store.ts). */
export interface Store {
  customers(): Promise<{ id: string; name: string }[]>;
  features(): Promise<{ id: string; name: string }[]>;
  /** workspace members: user_id -> display name */
  members(): Promise<{ user_id: string; name: string }[]>;
  /** tasks that have an external_key */
  tasks(): Promise<HelmTask[]>;
  deps(taskIds: string[]): Promise<{ task_id: string; depends_on_task_id: string }[]>;
  createTask(row: { external_key: string; title: string; status: string; due_date: string | null; assignee_id: string | null; customer_id: string | null; feature_id: string | null }): Promise<string>;
  updateTask(id: string, patch: Partial<Pick<HelmTask, "title" | "status" | "customer_id" | "feature_id">>): Promise<void>;
  deleteDeps(taskId: string): Promise<void>;
  /** throws an error with `.code === "23514"` on circular / self dependency */
  insertDep(taskId: string, dependsOnId: string): Promise<void>;
}

export type Config = { customers: Record<string, string>; features: Record<string, string> };
export type Ctx = {
  store: Store;
  vaultDir: string;
  config: Config;
  dryRun: boolean;
  /** first-run: new tasks take status/due/assignee from the file, and that file is not written back this cycle */
  seed?: boolean;
  now: Date;
  /** external keys seen in an earlier cycle; used to tell "deleted in Helm" from "new in vault" */
  knownKeys: Set<string>;
  quietMs?: number;
};
export type Report = {
  pushed: number;
  pulled: number;
  actions: string[];
  warnings: string[];
  errors: string[];
  knownKeys: Set<string>;
};

type Entry = { path: string; folder: string; id: string; title: string; module: string; deps: string[]; text: string; fields: Record<string, string> };

function walk(dir: string, out: string[]) {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (d.name.startsWith(".")) continue;
    const p = join(dir, d.name);
    if (d.isDirectory()) walk(p, out);
    else if (d.name.endsWith(".md") && !d.name.includes(".sync-conflict-") && p.split(sep).includes("_tasks")) out.push(p); // dotpm เปลี่ยนชื่อไฟล์เป็น slug ตัวเล็ก จึงคัดด้วย pm-task ใน scanVault ไม่ใช้ชื่อไฟล์
  }
}

export function cleanTitle(title: string, id: string): string {
  const t = title.trim();
  return t.startsWith(id) ? t.slice(id.length).replace(/^[\s·:–-]+/, "").trim() || t : t;
}

const norm = (s: string) => s.trim().toLowerCase();
const byName = (rows: { id: string; name: string }[], name: string) => rows.find((r) => norm(r.name) === norm(name))?.id ?? null;

export function scanVault(vaultDir: string, warnings: string[], errors: string[]) {
  const root = join(vaultDir, "ลูกค้า");
  if (!existsSync(root)) throw new Error(`ไม่พบโฟลเดอร์ ${root}`);
  const files: string[] = [];
  walk(root, files);
  const entries: Entry[] = [];
  for (const path of files.sort()) {
    const text = readFileSync(path, "utf8");
    const fm = parseFrontmatter(text);
    if (!fm || fm.fields["pm-task"] !== "true") continue;
    const id = fm.fields["id"] ?? "";
    if (!id) {
      warnings.push(`${path}: pm-task แต่ไม่มี id — ข้าม`);
      continue;
    }
    const folder = relative(root, path).split(sep)[0]!;
    const title = cleanTitle(fm.fields["title"] || path.split(sep).pop()!.replace(/\.md$/, ""), id);
    entries.push({ path, folder, id, title, module: fm.fields["module"] ?? "", deps: parseDependsOn(fm), text, fields: fm.fields });
  }
  const count = new Map<string, Entry[]>();
  for (const e of entries) count.set(e.id, [...(count.get(e.id) ?? []), e]);
  const valid: Entry[] = [];
  const duplicate = new Set<string>();
  for (const [id, es] of count) {
    if (es.length === 1) valid.push(es[0]!);
    else {
      duplicate.add(id);
      errors.push(`id ซ้ำ ${id} ใน ${es.map((e) => e.path).join(" , ")} — ข้ามทุกไฟล์`);
    }
  }
  return { valid, duplicate, fileCount: entries.length };
}

const STATUS_TH: Record<string, string> = { inbox: "Inbox", todo: "ยังไม่เริ่ม", in_progress: "กำลังทำ", testing: "ทดสอบ", done: "เสร็จแล้ว", cancelled: "ยกเลิก" };
const day = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localDateTime = (d: Date) => `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function warnCell(t: Pick<HelmTask, "status" | "due_date">, today: string): string {
  if (t.status === "done") return "✅";
  if (!t.due_date || t.status === "cancelled") return "";
  const diff = Math.round((day(t.due_date) - day(today)) / 86400000);
  if (diff < 0) return `🔴 เลยกำหนด ${-diff} วัน`;
  if (diff <= 3) return `🟡 อีก ${diff} วัน`;
  return "";
}

export function renderHelmTasks(tasks: HelmTask[], customers: Map<string, string>, now: Date): string {
  const cell = (s: string) => s.replace(/\|/g, "\\|");
  const rows = [...tasks]
    .sort((a, b) => (a.external_key < b.external_key ? -1 : 1))
    .map((t) => `| ${t.external_key} | ${cell(t.title)} | ${customers.get(t.customer_id ?? "") ?? "-"} | ${STATUS_TH[t.status] ?? t.status} | ${t.due_date ?? "-"} | ${warnCell(t, localDate(now))} |`);
  return `---
type: generated
source: helm.zkcnt.com/tasks/board
synced: ${localDateTime(now)}
tags: [helm, tasks, generated]
---

# Helm Tasks (T-*)

> [!warning] ไฟล์นี้ถูกสร้างอัตโนมัติจาก Helm ทุกครั้งที่ซิงก์ อย่าแก้ไขมือ ให้แก้ที่ Helm

| Task | งาน | ลูกค้า | สถานะ | กำหนดเสร็จ | สถานะเตือน |
|---|---|---|---|---|---|
${rows.join("\n")}
`;
}

const stripSynced = (s: string) => s.replace(/^synced: .*$/m, "");

/** write only when content (ignoring the `synced:` timestamp) changed */
function writeGenerated(path: string, content: string, ctx: Ctx, r: Report) {
  const old = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (old !== null && stripSynced(old) === stripSynced(content)) return;
  r.actions.push(`เขียน ${path.split(sep).pop()}`);
  if (!ctx.dryRun) writeFileSync(path, content);
}

export async function runCycle(ctx: Ctx): Promise<Report> {
  const r: Report = { pushed: 0, pulled: 0, actions: [], warnings: [], errors: [], knownKeys: new Set(ctx.knownKeys) };
  const { store } = ctx;
  const act = async (msg: string, kind: "push" | "pull" | "none", fn?: () => Promise<void> | void) => {
    r.actions.push(msg);
    if (kind === "push") r.pushed++;
    if (kind === "pull") r.pulled++;
    if (!ctx.dryRun && fn) await fn();
  };

  const { valid, duplicate, fileCount } = scanVault(ctx.vaultDir, r.warnings, r.errors);
  const [customers, features, members, tasks] = await Promise.all([store.customers(), store.features(), store.members(), store.tasks()]);
  const byKey = new Map(tasks.map((t) => [t.external_key, t]));

  if (fileCount === 0 && tasks.length > 0) {
    r.errors.push("ไม่พบไฟล์ Task ใน vault เลยแต่ Helm มี Task จาก vault — ข้ามรอบนี้ (vault อาจยังไม่ได้ mount)");
    return r;
  }

  // ---- Vault -> Helm: definition (title, customer, feature) ----
  const resolve = (e: Entry) => {
    const cName = ctx.config.customers[e.folder] ?? e.folder;
    const customer = byName(customers, cName);
    if (!customer) r.warnings.push(`${e.id}: ไม่พบลูกค้า "${cName}" ใน Helm (โฟลเดอร์ ${e.folder}) — ไม่ผูก`);
    let feature: string | null = null;
    if (e.module) {
      const fName = ctx.config.features[e.module] ?? e.module;
      feature = byName(features, fName);
      if (!feature) r.warnings.push(`${e.id}: ไม่พบ Feature "${fName}" ใน Helm (module ${e.module}) — ไม่ผูก`);
    }
    return { customer, feature };
  };

  const helmDeleted: Entry[] = [];
  const seeded = new Set<string>();
  for (const e of valid) {
    const t = byKey.get(e.id);
    const { customer, feature } = resolve(e);
    if (!t) {
      if (ctx.knownKeys.has(e.id)) {
        helmDeleted.push(e);
        continue;
      }
      if (!ctx.seed && e.fields["status"] === "superseded") continue; // Helm-deleted earlier (or retired in vault): never resurrect
      let status = "todo";
      let due: string | null = null;
      let assignee: string | null = null;
      if (ctx.seed) {
        status = toHelmStatus(e.fields["status"] ?? "") ?? "todo";
        const d = e.fields["due"] ?? "";
        due = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
        const a = norm(e.fields["assignee"] ?? "");
        assignee = (a && members.find((m) => norm(m.name) === a)?.user_id) || null;
        seeded.add(e.id);
      }
      let newId = `(planned:${e.id})`;
      await act(`สร้าง Task ${e.id} "${e.title}" (${status})`, "push", async () => {
        newId = await store.createTask({ external_key: e.id, title: e.title, status, due_date: due, assignee_id: assignee, customer_id: customer, feature_id: feature });
      });
      byKey.set(e.id, { id: newId, external_key: e.id, title: e.title, status, due_date: due, assignee_id: assignee, customer_id: customer, feature_id: feature });
      continue;
    }
    const patch: Parameters<Store["updateTask"]>[1] = {};
    if (t.title !== e.title) patch.title = e.title;
    if (customer && t.customer_id !== customer) patch.customer_id = customer;
    if (feature && t.feature_id !== feature) patch.feature_id = feature;
    if (Object.keys(patch).length) {
      await act(`แก้ Task ${e.id}: ${Object.keys(patch).join(", ")}`, "push", () => store.updateTask(t.id, patch));
      Object.assign(t, patch);
    }
  }

  // ---- depends_on -> task_dependencies (delete + reinsert) ----
  const real = (id: string) => !id.startsWith("(planned:");
  const existing = await store.deps(tasks.map((t) => t.id));
  for (const e of valid) {
    const t = byKey.get(e.id);
    if (!t || !real(t.id)) continue;
    const want = new Set<string>();
    for (const k of e.deps) {
      const d = byKey.get(k);
      if (!d) r.warnings.push(`${e.id}: depends_on ${k} ไม่พบใน Helm`);
      else if (real(d.id)) want.add(d.id);
    }
    const have = new Set(existing.filter((d) => d.task_id === t.id).map((d) => d.depends_on_task_id));
    if (want.size === have.size && [...want].every((x) => have.has(x))) continue;
    await act(`ตั้ง dependency ของ ${e.id} = [${e.deps.join(", ")}]`, "push", async () => {
      await store.deleteDeps(t.id);
      for (const d of want) {
        try {
          await store.insertDep(t.id, d);
        } catch (err) {
          const code = (err as { code?: string }).code;
          r.errors.push(`${e.id}: เพิ่ม dependency ไม่ได้${code === "23514" ? " (วนลูป/พึ่งตัวเอง)" : ""}: ${(err as Error).message}`);
        }
      }
    });
  }

  // ---- file missing -> cancelled ----
  const present = new Set([...valid.map((e) => e.id), ...duplicate]);
  for (const t of tasks) {
    if (present.has(t.external_key) || byKey.get(t.external_key) !== t) continue;
    r.knownKeys.delete(t.external_key);
    if (t.status === "cancelled") continue;
    await act(`ไฟล์ ${t.external_key} หายจาก vault → cancelled`, "push", () => store.updateTask(t.id, { status: "cancelled" }));
    t.status = "cancelled";
  }

  // ---- Helm -> Vault: status, due, assignee (surgical line edits) ----
  const names = new Map(members.map((m) => [m.user_id, m.name]));
  const quiet = ctx.quietMs ?? 30_000;
  for (const e of valid) {
    if (seeded.has(e.id)) continue; // seed cycle: file is the source, do not write back
    const t = byKey.get(e.id);
    const want: Record<string, string> = {};
    if (helmDeleted.includes(e)) want["status"] = "superseded";
    else if (t) {
      const vs = toVaultStatus(t.status);
      if (vs) want["status"] = vs;
      want["due"] = t.due_date ?? "";
      want["assignee"] = (t.assignee_id && names.get(t.assignee_id)) || "";
    }
    const edits: Record<string, string> = {};
    for (const [k, v] of Object.entries(want)) {
      const cur = e.fields[k];
      if ((cur ?? "") === v) continue;
      if (cur === undefined && v === "") continue; // nothing to clear
      edits[k] = k === "assignee" ? JSON.stringify(v) : k === "due" && v === "" ? '""' : v;
    }
    if (!Object.keys(edits).length) continue;
    if (ctx.now.getTime() - statSync(e.path).mtimeMs < quiet) {
      r.warnings.push(`${e.id}: ไฟล์ถูกแก้ภายใน ${quiet / 1000} วินาที — เลื่อนไปรอบหน้า`);
      continue;
    }
    const detail = Object.keys(edits).map((k) => `${k}: ${e.fields[k] ?? "(ไม่มี)"} → ${want[k] || '""'}`).join(", ");
    await act(`เขียนไฟล์ ${e.id} (Helm ชนะ) ${detail}`, "pull", () => {
      const next = setFrontmatterValues(e.text, edits);
      if (next !== e.text) writeFileSync(e.path, next);
    });
  }

  // ---- generated files ----
  const cmap = new Map(customers.map((c) => [c.id, c.name]));
  const live = [...byKey.values()];
  for (const t of live) if (present.has(t.external_key)) r.knownKeys.add(t.external_key);
  for (const e of helmDeleted) r.knownKeys.delete(e.id);
  const root = join(ctx.vaultDir, "ลูกค้า");
  writeGenerated(join(root, "Helm Tasks.md"), renderHelmTasks(live, cmap, ctx.now), ctx, r);
  return r;
}
