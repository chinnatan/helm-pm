-- Helm PM: Migration 036 — Task external key (Vault sync)
-- ADR 0003: รหัสงานจาก Vault (เช่น TNT-014) เป็นกุญแจจับคู่ Task ระหว่าง Helm กับ vault
-- tasks.external_key เป็น nullable (Task ที่สร้างใน Helm ไม่มีรหัส) และไม่ซ้ำภายใน workspace
-- RLS เป็น row-based และ log_task_changes ไม่อ้างถึงคอลัมน์นี้ จึงไม่ต้องแก้
-- rollback = DROP INDEX tasks_workspace_external_key_uniq; ALTER TABLE tasks DROP COLUMN external_key;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS external_key text;

COMMENT ON COLUMN public.tasks.external_key IS 'รหัสงานจาก Vault (frontmatter id) — ใช้จับคู่ตอน sync; null = สร้างใน Helm';

CREATE UNIQUE INDEX IF NOT EXISTS tasks_workspace_external_key_uniq
  ON public.tasks (workspace_id, external_key)
  WHERE external_key IS NOT NULL;
