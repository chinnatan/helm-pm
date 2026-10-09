-- =============================================================================
-- Helm PM: Migration 031 — Rollout-centric domain reset (ADR 0001)
-- =============================================================================
-- DESTRUCTIVE: ลบข้อมูล tasks (และตารางลูก), projects, milestones, meetings,
-- requirements, capacity ทั้งหมด — ต้อง export สำรองก่อนรันบน production
-- เก็บไว้: workspaces, members, customers, labels, task_templates, task_dependencies

-- 1) เคลียร์ข้อมูลโดเมนเดิม
TRUNCATE tasks CASCADE;
DELETE FROM notifications WHERE type LIKE 'project_overdue:%' OR type LIKE 'capacity%';

DROP TRIGGER IF EXISTS tasks_set_phase_order ON tasks;
DROP FUNCTION IF EXISTS set_task_phase_order();
DROP FUNCTION IF EXISTS run_capacity_alerts_for_workspace(uuid);
DROP TABLE IF EXISTS requirements, meetings, member_month_capacities, workspace_month_calendars, milestones CASCADE;
DROP TRIGGER IF EXISTS projects_audit_log ON projects;
DROP FUNCTION IF EXISTS audit_projects_changes();

-- 2) tasks: ถอด project/milestone/phase เพิ่ม workspace/feature/task_type + ชุด status ใหม่
DROP POLICY "Members can view tasks" ON tasks;
DROP POLICY "Writers can create tasks" ON tasks;
DROP POLICY "Writers can update tasks" ON tasks;
DROP POLICY "Managers can delete tasks" ON tasks;

ALTER TABLE tasks
  DROP COLUMN project_id,
  DROP COLUMN milestone_id,
  DROP COLUMN phase,
  DROP COLUMN phase_order,
  DROP CONSTRAINT tasks_status_check;

DROP TABLE projects CASCADE;
DROP FUNCTION IF EXISTS project_workspace_id(uuid);

ALTER TABLE tasks
  ADD COLUMN workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ADD COLUMN task_type TEXT NOT NULL DEFAULT 'feature'
    CHECK (task_type IN ('feature', 'bug', 'infra', 'customer-request')),
  ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('inbox', 'todo', 'in_progress', 'testing', 'done', 'cancelled'));

CREATE INDEX tasks_workspace_status_idx ON tasks(workspace_id, status);

CREATE OR REPLACE FUNCTION public.task_workspace_id(t_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT workspace_id FROM public.tasks WHERE id = t_id; $$;

CREATE POLICY "Members can view tasks" ON tasks FOR SELECT
  USING (is_workspace_member(workspace_id));
CREATE POLICY "Writers can create tasks" ON tasks FOR INSERT
  WITH CHECK (can_write_workspace(workspace_id));
CREATE POLICY "Writers can update tasks" ON tasks FOR UPDATE
  USING (can_write_workspace(workspace_id));
CREATE POLICY "Managers can delete tasks" ON tasks FOR DELETE
  USING (is_workspace_manager(workspace_id));

-- task_templates: ตัด phase และใช้ชุด status ใหม่
ALTER TABLE task_templates DROP CONSTRAINT task_templates_phase_check;
ALTER TABLE task_templates DROP COLUMN phase;
ALTER TABLE task_templates DROP CONSTRAINT task_templates_status_check;
UPDATE task_templates SET status = CASE status
  WHEN 'backlog' THEN 'inbox'
  WHEN 'ready_for_test' THEN 'testing'
  WHEN 'release' THEN 'done'
  ELSE status END;
ALTER TABLE task_templates ALTER COLUMN status SET DEFAULT 'todo';
ALTER TABLE task_templates ADD CONSTRAINT task_templates_status_check
  CHECK (status IN ('inbox', 'todo', 'in_progress', 'testing', 'done', 'cancelled'));

-- subtasks: ใช้ชุด status เดียวกับ tasks (ตาราง subtasks ว่างหลัง TRUNCATE tasks CASCADE)
ALTER TABLE subtasks DROP CONSTRAINT subtasks_status_check;
ALTER TABLE subtasks ADD CONSTRAINT subtasks_status_check
  CHECK (status IN ('inbox', 'todo', 'in_progress', 'testing', 'done', 'cancelled'));

-- 3) ตารางใหม่: features, rollouts, commitments, commitment_reschedules
CREATE TABLE features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#1e3a5f',
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

ALTER TABLE tasks ADD COLUMN feature_id UUID REFERENCES features(id) ON DELETE SET NULL;
CREATE INDEX tasks_feature_id_idx ON tasks(feature_id);

CREATE TABLE rollouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'developing', 'testing', 'production', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, feature_id)
);

-- 1 commitment = 1 rollout ต่อ 1 เดือน (month = วันแรกของเดือน)
CREATE TABLE commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rollout_id UUID NOT NULL REFERENCES rollouts(id) ON DELETE CASCADE,
  month DATE NOT NULL CHECK (month = date_trunc('month', month)::date),
  target_status TEXT NOT NULL DEFAULT 'production'
    CHECK (target_status IN ('developing', 'testing', 'production')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rollout_id, month)
);

CREATE TABLE commitment_reschedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id UUID NOT NULL REFERENCES commitments(id) ON DELETE CASCADE,
  from_month DATE NOT NULL,
  to_month DATE NOT NULL,
  reason TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rollouts_workspace_id_idx ON rollouts(workspace_id);
CREATE INDEX commitments_rollout_id_idx ON commitments(rollout_id);
CREATE INDEX commitment_reschedules_commitment_id_idx ON commitment_reschedules(commitment_id);

CREATE TRIGGER rollouts_updated_at
  BEFORE UPDATE ON rollouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION public.rollout_workspace_id(r_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT workspace_id FROM public.rollouts WHERE id = r_id; $$;

CREATE OR REPLACE FUNCTION public.commitment_workspace_id(c_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT r.workspace_id FROM public.commitments c
  JOIN public.rollouts r ON r.id = c.rollout_id WHERE c.id = c_id;
$$;

-- 4) RLS: สมาชิกอ่านได้, admin/manager เขียนได้
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE rollouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitment_reschedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view features" ON features FOR SELECT
  USING (is_workspace_member(workspace_id));
CREATE POLICY "Managers can manage features" ON features FOR ALL
  USING (is_workspace_manager(workspace_id))
  WITH CHECK (is_workspace_manager(workspace_id));

CREATE POLICY "Members can view rollouts" ON rollouts FOR SELECT
  USING (is_workspace_member(workspace_id));
CREATE POLICY "Managers can manage rollouts" ON rollouts FOR ALL
  USING (is_workspace_manager(workspace_id))
  WITH CHECK (is_workspace_manager(workspace_id));

CREATE POLICY "Members can view commitments" ON commitments FOR SELECT
  USING (is_workspace_member(rollout_workspace_id(rollout_id)));
CREATE POLICY "Managers can manage commitments" ON commitments FOR ALL
  USING (is_workspace_manager(rollout_workspace_id(rollout_id)))
  WITH CHECK (is_workspace_manager(rollout_workspace_id(rollout_id)));

CREATE POLICY "Members can view commitment reschedules" ON commitment_reschedules FOR SELECT
  USING (is_workspace_member(commitment_workspace_id(commitment_id)));
CREATE POLICY "Managers can add commitment reschedules" ON commitment_reschedules FOR INSERT
  WITH CHECK (is_workspace_manager(commitment_workspace_id(commitment_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON features, rollouts, commitments, commitment_reschedules TO authenticated;
GRANT SELECT ON features, rollouts, commitments, commitment_reschedules TO anon;
GRANT ALL ON features, rollouts, commitments, commitment_reschedules TO service_role;

-- 5) functions ที่เคยอ้าง tasks.project_id / milestone_id → ใช้ workspace_id (+ customer/feature)
CREATE OR REPLACE FUNCTION public.create_notification_from_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  actor_id uuid;
  actor_name text;
  task_title text;
  v_workspace_id uuid;
  recipient uuid;
  meta jsonb;
  msg text;
BEGIN
  IF NEW.action = 'created' OR NEW.field_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- Subtask assignment (and other subtask fields) are notified elsewhere or not at all
  IF NEW.subtask_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Legacy rows before subtask_id existed
  IF NEW.field_name IN ('subtask_assignee_id', 'subtask_tester_id') THEN
    RETURN NEW;
  END IF;

  actor_id := NEW.user_id;
  actor_name := public.profile_display_name(actor_id);

  SELECT title, workspace_id INTO task_title, v_workspace_id
  FROM tasks
  WHERE id = NEW.task_id;

  IF task_title IS NULL THEN
    task_title := 'Task';
  END IF;

  meta := jsonb_build_object(
    'workspace_id', v_workspace_id,
    'field', NEW.field_name,
    'old_value', NEW.old_value,
    'new_value', NEW.new_value
  );

  IF NEW.field_name = 'assignee_id' THEN
    IF NEW.new_value IS NULL OR NEW.new_value = '' THEN
      RETURN NEW;
    END IF;
    BEGIN
      recipient := NEW.new_value::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN NEW;
    END;
    msg := format('%s assigned you to "%s"', actor_name, task_title);
    PERFORM public.insert_task_notification(
      recipient, actor_id, NEW.task_id, 'task_assigned', msg, meta
    );
    RETURN NEW;
  END IF;

  IF NEW.field_name = 'tester_id' THEN
    IF NEW.new_value IS NULL OR NEW.new_value = '' THEN
      RETURN NEW;
    END IF;
    BEGIN
      recipient := NEW.new_value::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN NEW;
    END;
    msg := format('%s assigned you as tester on "%s"', actor_name, task_title);
    PERFORM public.insert_task_notification(
      recipient, actor_id, NEW.task_id, 'task_tester_assigned', msg, meta
    );
    RETURN NEW;
  END IF;

  IF NEW.field_name = 'status' THEN
    msg := format(
      '%s changed status of "%s" from %s to %s',
      actor_name,
      task_title,
      COALESCE(NEW.old_value, '—'),
      COALESCE(NEW.new_value, '—')
    );
    PERFORM public.notify_task_recipients(
      NEW.task_id, actor_id, 'task_status_changed', msg, meta, true
    );
    RETURN NEW;
  END IF;

  IF NEW.field_name = 'due_date' THEN
    msg := format(
      '%s updated due date on "%s" to %s',
      actor_name,
      task_title,
      COALESCE(NEW.new_value, 'none')
    );
    PERFORM public.notify_task_recipients(
      NEW.task_id, actor_id, 'task_due_date_changed', msg, meta, true
    );
    RETURN NEW;
  END IF;

  IF NEW.field_name = 'priority' THEN
    msg := format(
      '%s changed priority of "%s" to %s',
      actor_name,
      task_title,
      COALESCE(NEW.new_value, '—')
    );
    PERFORM public.notify_task_recipients(
      NEW.task_id, actor_id, 'task_priority_changed', msg, meta, false
    );
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_notification_on_task_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  actor_id uuid;
  actor_name text;
  meta jsonb;
BEGIN
  actor_id := COALESCE(auth.uid(), NEW.created_by);
  actor_name := public.profile_display_name(actor_id);
  meta := jsonb_build_object('workspace_id', NEW.workspace_id);

  IF NEW.assignee_id IS NOT NULL THEN
    PERFORM public.insert_task_notification(
      NEW.assignee_id,
      actor_id,
      NEW.id,
      'task_assigned',
      format('%s assigned you to "%s"', actor_name, NEW.title),
      meta
    );
  END IF;

  IF NEW.tester_id IS NOT NULL THEN
    PERFORM public.insert_task_notification(
      NEW.tester_id,
      actor_id,
      NEW.id,
      'task_tester_assigned',
      format('%s assigned you as tester on "%s"', actor_name, NEW.title),
      meta
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_task_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'status', OLD.status, NEW.status);
    END IF;
    IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'assignee_id', OLD.assignee_id::text, NEW.assignee_id::text);
    END IF;
    IF OLD.tester_id IS DISTINCT FROM NEW.tester_id THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'tester_id', OLD.tester_id::text, NEW.tester_id::text);
    END IF;
    IF OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'customer_id', OLD.customer_id::text, NEW.customer_id::text);
    END IF;
    IF OLD.feature_id IS DISTINCT FROM NEW.feature_id THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'feature_id', OLD.feature_id::text, NEW.feature_id::text);
    END IF;
    IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'due_date', OLD.due_date::text, NEW.due_date::text);
    END IF;
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'priority', OLD.priority, NEW.priority);
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (task_id, user_id, action)
    VALUES (NEW.id, auth.uid(), 'created');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_subtask_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  actor_id uuid;
  actor_name text;
  task_title text;
  v_workspace_id uuid;
  meta jsonb;
  msg text;
BEGIN
  actor_id := auth.uid();
  actor_name := public.profile_display_name(actor_id);

  SELECT title, workspace_id INTO task_title, v_workspace_id
  FROM tasks
  WHERE id = NEW.task_id;

  IF task_title IS NULL THEN
    task_title := 'Task';
  END IF;

  meta := jsonb_build_object(
    'workspace_id', v_workspace_id,
    'subtask_id', NEW.id,
    'subtask_title', NEW.title
  );

  IF (TG_OP = 'INSERT' AND NEW.assignee_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND OLD.assignee_id IS DISTINCT FROM NEW.assignee_id) THEN
    IF NEW.assignee_id IS NOT NULL THEN
      msg := format(
        '%s assigned you to subtask "%s" on "%s"',
        actor_name,
        NEW.title,
        task_title
      );
      PERFORM public.insert_task_notification(
        NEW.assignee_id,
        actor_id,
        NEW.task_id,
        'task_assigned',
        msg,
        meta || jsonb_build_object('field', 'assignee_id')
      );
    END IF;
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.tester_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND OLD.tester_id IS DISTINCT FROM NEW.tester_id) THEN
    IF NEW.tester_id IS NOT NULL THEN
      msg := format(
        '%s assigned you as tester on subtask "%s" of "%s"',
        actor_name,
        NEW.title,
        task_title
      );
      PERFORM public.insert_task_notification(
        NEW.tester_id,
        actor_id,
        NEW.task_id,
        'task_tester_assigned',
        msg,
        meta || jsonb_build_object('field', 'tester_id')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_task_recipients(p_task_id uuid, p_actor_id uuid, p_type text, p_message text, p_metadata jsonb, p_include_tester boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t record;
BEGIN
  SELECT assignee_id, tester_id, workspace_id INTO t
  FROM tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  p_metadata := COALESCE(p_metadata, '{}'::jsonb)
    || jsonb_build_object('workspace_id', t.workspace_id);

  IF t.assignee_id IS NOT NULL THEN
    PERFORM public.insert_task_notification(
      t.assignee_id, p_actor_id, p_task_id, p_type, p_message, p_metadata
    );
  END IF;

  IF p_include_tester AND t.tester_id IS NOT NULL AND t.tester_id IS DISTINCT FROM t.assignee_id THEN
    PERFORM public.insert_task_notification(
      t.tester_id, p_actor_id, p_task_id, p_type, p_message, p_metadata
    );
  END IF;
END;
$function$;
