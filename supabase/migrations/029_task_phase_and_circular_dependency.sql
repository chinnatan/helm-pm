-- =============================================================================
-- Helm PM: Migration 029 — SDLC Phase Tracking + Circular Dependency Prevention
-- =============================================================================
-- 1) tasks.phase / milestones.phase — ขั้นตอน SDLC ของงาน
-- 2) tasks.phase_order — ลำดับ phase สำหรับจัดกลุ่มใน Kanban/Gantt (auto จาก trigger)
-- 3) check_circular_dependency() — ป้องกัน circular dependency แบบ transitive ระดับ DB
--    ใช้ task_dependencies table ที่มีอยู่แล้ว (task_id, depends_on_task_id) — ไม่เพิ่ม column

-- =============================================================================
-- 1) tasks: เพิ่ม phase + phase_order
-- =============================================================================
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS phase TEXT CHECK (phase IN (
    'requirements', 'analysis', 'design', 'development', 'testing', 'deployment', 'done'
  ));

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS phase_order INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN tasks.phase IS 'SDLC phase ของงาน: requirements/analysis/design/development/testing/deployment/done (nullable = ยังไม่ได้ระบุ)';
COMMENT ON COLUMN tasks.phase_order IS 'ลำดับของ phase (1..7, 0 = ยังไม่มี phase) — auto-set โดย trigger tasks_set_phase_order';

-- =============================================================================
-- 2) milestones: เพิ่ม phase (ค่าเดียวกับ tasks.phase)
-- =============================================================================
ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS phase TEXT CHECK (phase IN (
    'requirements', 'analysis', 'design', 'development', 'testing', 'deployment', 'done'
  ));

COMMENT ON COLUMN milestones.phase IS 'SDLC phase ของ milestone (nullable = ยังไม่ได้ระบุ)';

-- =============================================================================
-- 3) Trigger: auto-set phase_order ตามค่า phase
-- =============================================================================
CREATE OR REPLACE FUNCTION set_task_phase_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.phase_order := CASE NEW.phase
    WHEN 'requirements' THEN 1
    WHEN 'analysis'     THEN 2
    WHEN 'design'       THEN 3
    WHEN 'development'  THEN 4
    WHEN 'testing'      THEN 5
    WHEN 'deployment'   THEN 6
    WHEN 'done'         THEN 7
    ELSE 0
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_set_phase_order ON tasks;
CREATE TRIGGER tasks_set_phase_order
  BEFORE INSERT OR UPDATE OF phase ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_task_phase_order();

-- backfill ค่า phase_order ให้แถวเดิมที่มี phase อยู่แล้ว (ตอนนี้ยังไม่มี แต่กันไว้กรณีรันซ้ำ)
UPDATE tasks SET phase = phase WHERE phase IS NOT NULL;

-- =============================================================================
-- 4) Circular dependency prevention (transitive) ระดับ DB
-- =============================================================================
-- ใช้ recursive walk: จาก depends_on_task_id ของแถวที่จะ insert/update
-- ถ้าเดินตามกราฟ "depends on" แล้ววนกลับมาเจอ task_id ได้ = เกิด cycle
-- depth limit 100 กัน loop ไม่สิ้นสุดกรณีข้อมูลเดิมมี cycle ค้างอยู่
CREATE OR REPLACE FUNCTION check_circular_dependency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE dep_chain AS (
      SELECT depends_on_task_id AS id, 1 AS depth
      FROM task_dependencies
      WHERE task_id = NEW.depends_on_task_id
      UNION ALL
      SELECT td.depends_on_task_id, dc.depth + 1
      FROM task_dependencies td
      JOIN dep_chain dc ON td.task_id = dc.id
      WHERE dc.depth < 100
    )
    SELECT 1 FROM dep_chain WHERE id = NEW.task_id
  ) THEN
    RAISE EXCEPTION 'Circular task dependency detected: task % cannot depend on task %', NEW.task_id, NEW.depends_on_task_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_dependencies_check_circular ON task_dependencies;
CREATE TRIGGER task_dependencies_check_circular
  BEFORE INSERT OR UPDATE OF task_id, depends_on_task_id ON task_dependencies
  FOR EACH ROW EXECUTE FUNCTION check_circular_dependency();

-- =============================================================================
-- 5) RLS
-- =============================================================================
-- ไม่ต้องอัปเดต policies — RLS ของ tasks / milestones / task_dependencies
-- เป็น row-based (ไม่อ้างอิงชื่อ column) จึงครอบคลุม column ใหม่โดยอัตโนมัติ
