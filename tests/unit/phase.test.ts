import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TASK_PHASE_ORDER, TASK_PHASE_VALUES, taskPhaseMeta } from "~/types";

const migration029 = readFileSync(
  new URL("../../supabase/migrations/029_task_phase_and_circular_dependency.sql", import.meta.url),
  "utf8",
);

// ค่า phase ใน CHECK constraint ของ tasks (migration 029)
const checkConstraintMatch = migration029.match(
  /phase TEXT CHECK \(phase IN \(([\s\S]*?)\)\)/,
)?.[1];
const checkConstraintPhases = [...(checkConstraintMatch ?? "").matchAll(/'([a-z_]+)'/g)].map(
  (m) => m[1] as string,
);

describe("TASK_PHASE_ORDER", () => {
  it("TASK_PHASE_ORDER ตรงกับ CHECK constraint ใน migration 029", () => {
    expect(TASK_PHASE_VALUES.map((p) => p.value)).toEqual([
      "requirements",
      "analysis",
      "design",
      "development",
      "testing",
      "deployment",
      "done",
    ]);
    expect(checkConstraintPhases).toEqual(TASK_PHASE_VALUES.map((p) => p.value));
  });

  it("ลำดับ phase เพิ่มทีละขั้นไม่มีสะดุด", () => {
    const orders = TASK_PHASE_VALUES.map((p) => TASK_PHASE_ORDER[p.value]);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7]);

    // trigger set_task_phase_order() ใน migration ต้อง map ตรงกับ TASK_PHASE_ORDER
    const triggerMap = Object.fromEntries(
      [...migration029.matchAll(/WHEN '([a-z_]+)'\s+THEN (\d+)/g)].map((m) => [m[1], Number(m[2])]),
    );
    expect(triggerMap).toEqual({ ...TASK_PHASE_ORDER });
  });
});

describe("taskPhaseMeta", () => {
  it("taskPhaseMeta คืน label/icon/color ครบทุก phase", () => {
    for (const value of TASK_PHASE_VALUES.map((p) => p.value)) {
      const meta = taskPhaseMeta(value);
      expect(meta).toBeDefined();
      expect(meta?.label).toBeTruthy();
      expect(meta?.icon).toBeTruthy();
      expect(meta?.color).toBeTruthy();
    }
  });

  it("taskPhaseMeta คืน undefined เมื่อ phase เป็น null/undefined", () => {
    expect(taskPhaseMeta(null)).toBeUndefined();
    expect(taskPhaseMeta(undefined)).toBeUndefined();
  });
});

it("TASK_PHASE_VALUES ไม่มีค่าซ้ำ", () => {
  const values = TASK_PHASE_VALUES.map((p) => p.value);
  expect(new Set(values).size).toBe(values.length);
});
