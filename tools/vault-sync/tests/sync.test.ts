import { mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { runCycle, scanVault, type Ctx, type HelmTask, type Store } from "../src/sync";

function fakeStore(init: { tasks?: HelmTask[]; deps?: [string, string][] } = {}) {
  const s = {
    tasks: init.tasks ?? ([] as HelmTask[]),
    deps: (init.deps ?? []).map(([task_id, depends_on_task_id]) => ({ task_id, depends_on_task_id })),
    n: 0,
    writes: 0,
    store: null as unknown as Store,
  };
  s.store = {
    customers: async () => [{ id: "c1", name: "คุณแม็ก" }],
    features: async () => [{ id: "f1", name: "Inspection" }],
    members: async () => [{ user_id: "u1", name: "สมชาย ใจดี" }],
    tasks: async () => s.tasks.map((t) => ({ ...t })),
    deps: async () => s.deps.map((d) => ({ ...d })),
    createTask: async (row) => {
      s.writes++;
      const t: HelmTask = { id: `id${++s.n}`, ...row };
      s.tasks.push(t);
      return t.id;
    },
    updateTask: async (id, patch) => {
      s.writes++;
      Object.assign(s.tasks.find((t) => t.id === id)!, patch);
    },
    deleteDeps: async (id) => {
      s.writes++;
      s.deps = s.deps.filter((d) => d.task_id !== id);
    },
    insertDep: async (a, b) => {
      s.writes++;
      if (a === b) throw Object.assign(new Error("cycle"), { code: "23514" });
      s.deps.push({ task_id: a, depends_on_task_id: b });
    },
  };
  return s;
}

const fm = (id: string, extra = "") =>
  `---\npm-task: true\nid: ${id}\ntitle: "${id} ชื่องาน ${id}"\nmodule: Inspection\nstatus: todo\n${extra}---\nเนื้อหา\n`;
const task = (key: string, o: Partial<HelmTask> = {}): HelmTask => ({
  id: `h-${key}`, external_key: key, title: `ชื่องาน ${key}`, status: "todo", due_date: null, assignee_id: null, customer_id: "c1", feature_id: "f1", ...o,
});

let vault: string;
let dir: string;
const old = (p: string) => utimesSync(p, new Date(0), new Date(0));
const put = (name: string, text: string) => {
  const p = join(dir, name);
  writeFileSync(p, text);
  old(p);
  return p;
};
const ctx = (store: Store, extra: Partial<Ctx> = {}): Ctx => ({
  store, vaultDir: vault, config: { customers: {}, features: {} }, dryRun: false, now: new Date("2026-11-16T09:00:00"), knownKeys: new Set(), ...extra,
});

beforeEach(() => {
  vault = mkdtempSync(join(tmpdir(), "vs-"));
  dir = join(vault, "ลูกค้า", "คุณแม็ก", "Plan A", "00 README", "_tasks");
  mkdirSync(dir, { recursive: true });
});

describe("scan", () => {
  it("skips conflict copies and non pm-task; duplicate ids skip both files with error", () => {
    put("T-A-01 x.md", fm("T-A-01"));
    put("T-A-01 x.sync-conflict-20260101-abc.md", fm("T-A-01"));
    put("T-A-02 a.md", fm("T-A-02"));
    put("T-A-02 b.md", fm("T-A-02"));
    put("T-A-03 n.md", "---\nid: T-A-03\n---\n");
    const errors: string[] = [];
    const r = scanVault(vault, [], errors);
    expect(r.valid.map((e) => e.id)).toEqual(["T-A-01"]);
    expect([...r.duplicate]).toEqual(["T-A-02"]);
    expect(errors).toHaveLength(1);
  });

  it("scans dotpm slug-renamed (lowercase) task files by pm-task, not by filename", () => {
    put("t-a-05-ชื่อ-slug.md", fm("T-A-05"));
    const r = scanVault(vault, [], []);
    expect(r.valid.map((e) => e.id)).toEqual(["T-A-05"]);
  });
});

describe("cycle", () => {
  it("push: creates task (todo, customer from folder, feature from module); never creates customer/feature", async () => {
    put("T-A-01 x.md", fm("T-A-01"));
    const f = fakeStore();
    const r = await runCycle(ctx(f.store));
    expect(f.tasks).toMatchObject([{ external_key: "T-A-01", title: "ชื่องาน T-A-01", status: "todo", customer_id: "c1", feature_id: "f1" }]);
    expect(r.pushed).toBe(1);
    const g = fakeStore();
    put("T-A-01 x.md", fm("T-A-01").replace("Inspection", "Nope"));
    const r2 = await runCycle(ctx(g.store, { config: { customers: { คุณแม็ก: "ไม่มี" }, features: {} } }));
    expect(g.tasks[0]).toMatchObject({ customer_id: null, feature_id: null });
    expect(r2.warnings.length).toBe(2);
  });

  it("pull: writes Helm status/due/assignee into frontmatter lines only", async () => {
    const p = put("T-A-01 x.md", fm("T-A-01"));
    const f = fakeStore({ tasks: [task("T-A-01", { status: "testing", due_date: "2026-11-20", assignee_id: "u1" })] });
    const r = await runCycle(ctx(f.store));
    expect(readFileSync(p, "utf8")).toBe(
      fm("T-A-01").replace("status: todo\n", "status: review\n").replace("---\nเนื้อหา", 'due: 2026-11-20\nassignee: "สมชาย ใจดี"\n---\nเนื้อหา'),
    );
    expect(r.pulled).toBe(1);
  });

  it("skips files modified in the last 30s", async () => {
    const p = join(dir, "T-A-01 x.md");
    writeFileSync(p, fm("T-A-01")); // mtime = now
    const f = fakeStore({ tasks: [task("T-A-01", { status: "done" })] });
    const r = await runCycle(ctx(f.store, { now: new Date() }));
    expect(readFileSync(p, "utf8")).toBe(fm("T-A-01"));
    expect(r.pulled).toBe(0);
    expect(r.warnings.join()).toContain("30");
  });

  it("file removed -> cancelled, row kept", async () => {
    put("T-A-01 x.md", fm("T-A-01"));
    const f = fakeStore({ tasks: [task("T-A-01"), task("T-A-09")] });
    const r = await runCycle(ctx(f.store));
    expect(f.tasks.find((t) => t.external_key === "T-A-09")!.status).toBe("cancelled");
    expect(f.tasks).toHaveLength(2);
    expect(r.pushed).toBe(1);
  });

  it("empty vault does not mass-cancel", async () => {
    const f = fakeStore({ tasks: [task("T-A-09")] });
    const r = await runCycle(ctx(f.store));
    expect(f.tasks[0]!.status).toBe("todo");
    expect(r.errors).toHaveLength(1);
  });

  it("depends_on -> dependencies (delete + reinsert), cycle error is logged not thrown", async () => {
    put("T-A-01 x.md", fm("T-A-01", 'depends_on: ["[[T-A-02 b]]", "[[T-A-01 self]]"]\n'));
    put("T-A-02 b.md", fm("T-A-02"));
    const f = fakeStore({ tasks: [task("T-A-01"), task("T-A-02")], deps: [["h-T-A-01", "h-T-A-99"]] });
    const r = await runCycle(ctx(f.store));
    expect(f.deps).toEqual([{ task_id: "h-T-A-01", depends_on_task_id: "h-T-A-02" }]);
    expect(r.errors.join()).toContain("วนลูป");
  });

  it("task deleted in Helm (known key, no row) -> status: superseded; not recreated afterwards", async () => {
    const p = put("T-A-01 x.md", fm("T-A-01"));
    const f = fakeStore();
    const r = await runCycle(ctx(f.store, { knownKeys: new Set(["T-A-01"]) }));
    expect(readFileSync(p, "utf8")).toContain("status: superseded");
    expect(f.tasks).toHaveLength(0);
    old(p);
    await runCycle(ctx(f.store, { knownKeys: r.knownKeys }));
    expect(f.tasks).toHaveLength(0);
  });

  it("dry-run writes nothing (store, vault files, generated files)", async () => {
    const p = put("T-A-01 x.md", fm("T-A-01"));
    put("T-A-02 y.md", fm("T-A-02"));
    const f = fakeStore({ tasks: [task("T-A-02", { status: "done" }), task("T-A-09")] });
    const r = await runCycle(ctx(f.store, { dryRun: true }));
    expect(r.actions.length).toBeGreaterThan(2);
    expect(f.writes).toBe(0);
    expect(f.tasks).toHaveLength(2);
    expect(readFileSync(p, "utf8")).toBe(fm("T-A-01"));
    expect(() => readFileSync(join(vault, "ลูกค้า", "Helm Tasks.md"))).toThrow();
  });

  it("generated files: format, emoji rules, and no rewrite when content is unchanged", async () => {
    put("T-A-01 x.md", fm("T-A-01"));
    const f = fakeStore({ tasks: [task("T-A-01", { status: "testing", due_date: "2026-11-02", customer_id: "c1" })] });
    await runCycle(ctx(f.store));
    const tp = join(vault, "ลูกค้า", "Helm Tasks.md");
    const txt = readFileSync(tp, "utf8");
    expect(txt).toContain("| T-A-01 | ชื่องาน T-A-01 | คุณแม็ก | ทดสอบ | 2026-11-02 | 🔴 เลยกำหนด 14 วัน |");
    expect(txt).toContain("synced: 2026-11-16 09:00");
    expect(readFileSync(join(vault, "ลูกค้า", "Helm Sync Log.md"), "utf8")).toContain("push");
    old(tp);
    old(join(dir, "T-A-01 x.md"));
    await runCycle(ctx(f.store, { now: new Date("2026-11-16T09:05:00") }));
    expect(readFileSync(tp, "utf8")).toContain("synced: 2026-11-16 09:00"); // untouched
  });

  describe("seed", () => {
    const doneFile = () => fm("T-A-01", 'due: 2026-11-20\nassignee: "สมชาย ใจดี"\n').replace("status: todo", "status: done");
    it("--seed keeps a done file done in Helm, file byte-identical; later normal cycle pulls Helm status", async () => {
      const p = put("T-A-01 x.md", doneFile());
      const f = fakeStore();
      const r = await runCycle(ctx(f.store, { seed: true }));
      expect(f.tasks).toMatchObject([{ status: "done", due_date: "2026-11-20", assignee_id: "u1" }]);
      expect(readFileSync(p, "utf8")).toBe(doneFile());
      expect(r.pulled).toBe(0);
      f.tasks[0]!.status = "testing"; // Helm moves on
      await runCycle(ctx(f.store, { knownKeys: r.knownKeys }));
      expect(readFileSync(p, "utf8")).toContain("status: review");
    });
    it("--seed maps legacy dotpm `cancelled` to Helm cancelled, blocked to todo", async () => {
      put("T-A-07 x.md", fm("T-A-07").replace("status: todo", "status: cancelled"));
      put("T-A-08 x.md", fm("T-A-08").replace("status: todo", "status: blocked"));
      const f = fakeStore();
      await runCycle(ctx(f.store, { seed: true }));
      expect(f.tasks.find((t) => t.external_key === "T-A-07")!.status).toBe("cancelled");
      expect(f.tasks.find((t) => t.external_key === "T-A-08")!.status).toBe("todo");
    });

    it("without --seed a new task is todo", async () => {
      put("T-A-01 x.md", doneFile());
      const f = fakeStore();
      await runCycle(ctx(f.store));
      expect(f.tasks[0]).toMatchObject({ status: "todo", due_date: null, assignee_id: null });
    });
    it("--seed --dry-run writes nothing but plans the mapped status", async () => {
      const p = put("T-A-01 x.md", doneFile());
      const f = fakeStore();
      const r = await runCycle(ctx(f.store, { seed: true, dryRun: true }));
      expect(f.writes).toBe(0);
      expect(readFileSync(p, "utf8")).toBe(doneFile());
      expect(r.actions.join()).toContain("(done)");
    });
  });
});
