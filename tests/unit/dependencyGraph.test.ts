import { describe, expect, it } from "vitest";
import type { Task, TaskDependency, TaskStatus } from "~/types";
import { graphBlockedBy, graphIsBlocked, graphWouldCreateCycle } from "~/utils/dependencyGraph";

const dep = (taskId: string, dependsOnTaskId: string): TaskDependency => ({
  id: `${taskId}->${dependsOnTaskId}`,
  task_id: taskId,
  depends_on_task_id: dependsOnTaskId,
});

const task = (id: string, status: TaskStatus) => ({ id, status }) as Task;
const byId = (...tasks: Task[]) => new Map(tasks.map((t) => [t.id, t]));

describe("wouldCreateCycle", () => {
  it("ปฏิเสธการพึ่งพาตัวเอง (A→A)", () => {
    expect(graphWouldCreateCycle([], "A", "A")).toBe(true);
  });

  it("ตรวจจับวงวนตรง A↔B", () => {
    expect(graphWouldCreateCycle([dep("A", "B")], "B", "A")).toBe(true);
  });

  it("ตรวจจับวงวนข้ามหลายชั้น A→B→C→A", () => {
    const deps = [dep("A", "B"), dep("B", "C")];
    expect(graphWouldCreateCycle(deps, "C", "A")).toBe(true);
  });

  it("ตรวจจับวงวนระยะไกล (โซ่ 5 งาน)", () => {
    const deps = [dep("A", "B"), dep("B", "C"), dep("C", "D"), dep("D", "E")];
    expect(graphWouldCreateCycle(deps, "E", "A")).toBe(true);
  });

  it("DAG รูป diamond ต้องไม่ report cycle", () => {
    const deps = [dep("A", "B"), dep("A", "C"), dep("B", "D"), dep("C", "D")];
    expect(graphWouldCreateCycle(deps, "A", "D")).toBe(false);
  });

  it("วงวนคนละกลุ่มงานไม่กระทบกัน", () => {
    const deps = [dep("A", "B"), dep("B", "C"), dep("C", "A"), dep("D", "E")];
    expect(graphWouldCreateCycle(deps, "D", "A")).toBe(false);
  });

  it("กราฟว่าง ไม่เจอวงวน", () => {
    expect(graphWouldCreateCycle([], "A", "B")).toBe(false);
  });
});

describe("blockedBy / isBlocked", () => {
  it("ไม่มี dependency ไม่ถูกบล็อก", () => {
    const tasks = byId(task("X", "todo"));
    expect(graphBlockedBy([], tasks, "X")).toEqual([]);
    expect(graphIsBlocked([], tasks, "X")).toBe(false);
  });

  it("งาน in_progress ที่รออยู่ ทำให้ถูกบล็อก", () => {
    const P = task("P", "in_progress");
    const tasks = byId(task("X", "todo"), P);
    const deps = [dep("X", "P")];
    expect(graphBlockedBy(deps, tasks, "X").map((t) => t.id)).toEqual(["P"]);
    expect(graphIsBlocked(deps, tasks, "X")).toBe(true);
  });

  it("งาน done ไม่บล็อก", () => {
    const tasks = byId(task("X", "todo"), task("P", "done"));
    const deps = [dep("X", "P")];
    expect(graphBlockedBy(deps, tasks, "X")).toEqual([]);
    expect(graphIsBlocked(deps, tasks, "X")).toBe(false);
  });

  it("งาน released ไม่บล็อก", () => {
    const tasks = byId(task("X", "todo"), task("P", "release"));
    const deps = [dep("X", "P")];
    expect(graphBlockedBy(deps, tasks, "X")).toEqual([]);
    expect(graphIsBlocked(deps, tasks, "X")).toBe(false);
  });

  it("งาน cancelled ไม่บล็อก", () => {
    const tasks = byId(task("X", "todo"), task("P", "cancelled"));
    const deps = [dep("X", "P")];
    expect(graphBlockedBy(deps, tasks, "X")).toEqual([]);
    expect(graphIsBlocked(deps, tasks, "X")).toBe(false);
  });

  it("ถูกบล็อกโดยหลายงานพร้อมกัน คืนครบทุกงาน", () => {
    const P1 = task("P1", "todo");
    const P2 = task("P2", "in_progress");
    const tasks = byId(task("X", "backlog"), P1, P2);
    const deps = [dep("X", "P1"), dep("X", "P2")];
    expect(graphBlockedBy(deps, tasks, "X").map((t) => t.id)).toEqual(["P1", "P2"]);
  });

  it("ผสม done + เปิดอยู่ คืนเฉพาะที่ยังเปิด", () => {
    const P1 = task("P1", "done");
    const P2 = task("P2", "todo");
    const tasks = byId(task("X", "backlog"), P1, P2);
    const deps = [dep("X", "P1"), dep("X", "P2")];
    expect(graphBlockedBy(deps, tasks, "X").map((t) => t.id)).toEqual(["P2"]);
  });

  it("dep ชี้ไป task ที่ไม่มีใน map ไม่ crash", () => {
    const tasks = byId(task("X", "todo"));
    const deps = [dep("X", "Ghost")];
    expect(graphBlockedBy(deps, tasks, "X")).toEqual([]);
    expect(graphIsBlocked(deps, tasks, "X")).toBe(false);
  });
});
