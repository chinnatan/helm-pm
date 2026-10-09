import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TASK_PRIORITY_META, TASK_STATUS_VALUES } from "~/types";

const migration = readFileSync(
  new URL("../../supabase/migrations/030_task_templates.sql", import.meta.url),
  "utf8",
);
const resetMigration = readFileSync(
  new URL("../../supabase/migrations/031_rollout_domain_reset.sql", import.meta.url),
  "utf8",
);

describe("task_templates migration", () => {
  it("contains the template payload columns", () => {
    for (const column of [
      "workspace_id",
      "created_by",
      "title",
      "description",
      "priority",
      "status",
      "estimate_hours",
      "label_ids",
      "created_at",
      "updated_at",
    ]) {
      expect(migration).toMatch(new RegExp(`\\b${column}\\b`));
    }
  });

  it("keeps enum checks aligned with application values", () => {
    const values = (text: string) => [...text.matchAll(/'([^']+)'/g)].map((match) => match[1]);
    const priorityCheck = migration.match(/priority TEXT NOT NULL[\s\S]*?CHECK \(priority IN \(([^)]+)\)/)?.[1] ?? "";
    const statusCheck =
      resetMigration.match(/ADD CONSTRAINT task_templates_status_check\s+CHECK \(status IN \(([^)]+)\)/)?.[1] ?? "";
    expect(values(priorityCheck)).toEqual(TASK_PRIORITY_META.map((item) => item.value));
    expect(values(statusCheck)).toEqual(TASK_STATUS_VALUES);
  });
});
