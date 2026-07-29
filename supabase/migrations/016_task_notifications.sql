-- Helm PM: task notifications (DB triggers), delivery log, notification preferences

-- -----------------------------------------------------------------------------
-- notifications.metadata — project_id, old/new status, etc.
-- -----------------------------------------------------------------------------
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- -----------------------------------------------------------------------------
-- profiles — notification preferences (web push via OneSignal)
-- -----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{
    "web_push_enabled": true,
    "mention": true,
    "task_assigned": true,
    "task_tester_assigned": true,
    "task_status_changed": true,
    "task_due_date_changed": true,
    "task_priority_changed": true,
    "capacity": true
  }'::jsonb;

-- -----------------------------------------------------------------------------
-- notification_deliveries — push send audit (service role / worker)
-- -----------------------------------------------------------------------------
CREATE TABLE notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'onesignal',
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, channel)
);

CREATE INDEX idx_notification_deliveries_notification
  ON notification_deliveries (notification_id);

ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;

-- No policies: authenticated users cannot read/write; service role bypasses RLS

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profile_display_name(p_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
    NULLIF(trim(p.full_name), ''),
    p.email,
    'Someone'
  )
  FROM profiles p
  WHERE p.id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.insert_task_notification(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_task_id uuid,
  p_type text,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_recipient_id IS NULL THEN
    RETURN;
  END IF;
  IF p_actor_id IS NOT NULL AND p_recipient_id = p_actor_id THEN
    RETURN;
  END IF;

  INSERT INTO notifications (user_id, task_id, type, message, metadata)
  VALUES (p_recipient_id, p_task_id, p_type, p_message, COALESCE(p_metadata, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_task_recipients(
  p_task_id uuid,
  p_actor_id uuid,
  p_type text,
  p_message text,
  p_metadata jsonb,
  p_include_tester boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
BEGIN
  SELECT assignee_id, tester_id, project_id INTO t
  FROM tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  p_metadata := COALESCE(p_metadata, '{}'::jsonb)
    || jsonb_build_object('project_id', t.project_id);

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
$$;

-- -----------------------------------------------------------------------------
-- activity_log → notifications
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notification_from_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid;
  actor_name text;
  task_title text;
  task_project_id uuid;
  recipient uuid;
  meta jsonb;
  msg text;
BEGIN
  IF NEW.action = 'created' OR NEW.field_name IS NULL THEN
    RETURN NEW;
  END IF;

  actor_id := NEW.user_id;
  actor_name := public.profile_display_name(actor_id);

  SELECT title, project_id INTO task_title, task_project_id
  FROM tasks
  WHERE id = NEW.task_id;

  IF task_title IS NULL THEN
    task_title := 'Task';
  END IF;

  meta := jsonb_build_object(
    'project_id', task_project_id,
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
$$;

DROP TRIGGER IF EXISTS activity_log_create_notification ON activity_log;
CREATE TRIGGER activity_log_create_notification
  AFTER INSERT ON activity_log
  FOR EACH ROW
  EXECUTE FUNCTION public.create_notification_from_activity();

-- -----------------------------------------------------------------------------
-- New task with assignee / tester
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notification_on_task_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid;
  actor_name text;
  meta jsonb;
BEGIN
  actor_id := COALESCE(auth.uid(), NEW.created_by);
  actor_name := public.profile_display_name(actor_id);
  meta := jsonb_build_object('project_id', NEW.project_id);

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
$$;

DROP TRIGGER IF EXISTS tasks_insert_notification ON tasks;
CREATE TRIGGER tasks_insert_notification
  AFTER INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_notification_on_task_insert();

-- -----------------------------------------------------------------------------
-- Capacity alerts cron (service role / worker)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_capacity_alerts_cron()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws record;
  total int := 0;
BEGIN
  FOR ws IN SELECT id FROM workspaces LOOP
    total := total + public.run_capacity_alerts_for_workspace(ws.id);
  END LOOP;
  RETURN total;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_capacity_alerts_for_workspace(p_workspace_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  week_key text;
  today date := (timezone('utc', now()))::date;
  inserted int := 0;
  mgr record;
  proj record;
  overdue_count int;
  type_base text;
  msg text;
BEGIN
  -- Next Monday (ISO), matches app nextWeekStartKey()
  week_key := to_char(
    today - (extract(isodow from today)::int - 1) + 7,
    'YYYY-MM-DD'
  );

  -- Project overdue: >= 3 open overdue tasks per project
  FOR proj IN
    SELECT p.id, p.name, p.owner_id
    FROM projects p
    WHERE p.workspace_id = p_workspace_id
      AND p.archived_at IS NULL
  LOOP
    SELECT count(*)::int INTO overdue_count
    FROM tasks t
    WHERE t.project_id = proj.id
      AND t.status NOT IN ('done', 'release', 'cancelled')
      AND t.due_date IS NOT NULL
      AND t.due_date < today;

    IF overdue_count < 3 THEN
      CONTINUE;
    END IF;

    type_base := format('project_overdue:%s:%s', proj.id, week_key);
    msg := format('Project "%s" has %s overdue tasks', proj.name, overdue_count);

    FOR mgr IN
      SELECT DISTINCT wm.user_id
      FROM workspace_members wm
      WHERE wm.workspace_id = p_workspace_id
        AND wm.role IN ('admin', 'manager')
      UNION
      SELECT proj.owner_id WHERE proj.owner_id IS NOT NULL
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.type = type_base || ':' || mgr.user_id::text
      ) THEN
        INSERT INTO notifications (user_id, task_id, type, message, metadata)
        VALUES (
          mgr.user_id,
          NULL,
          type_base || ':' || mgr.user_id::text,
          msg,
          jsonb_build_object('project_id', proj.id, 'workspace_id', p_workspace_id)
        );
        inserted := inserted + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.run_capacity_alerts_cron() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_capacity_alerts_for_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_capacity_alerts_cron() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_capacity_alerts_for_workspace(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
