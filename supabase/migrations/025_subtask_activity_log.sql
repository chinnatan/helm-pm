-- Subtask activity log: activity_log.subtask_id + change trigger
-- Assignment notifications stay on notify_on_subtask_assignment;
-- activity_log → notifications skips rows with subtask_id to avoid duplicates / wrong parent msgs.

ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS subtask_id UUID REFERENCES subtasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS activity_log_subtask_id_idx ON activity_log(subtask_id);

COMMENT ON COLUMN activity_log.subtask_id IS 'When set, this log row is about a subtask (task_id is still the parent)';

-- -----------------------------------------------------------------------------
-- Log subtask create / field changes (not description / labels)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_subtask_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (task_id, subtask_id, user_id, action)
    VALUES (NEW.task_id, NEW.id, auth.uid(), 'created');
    RETURN NEW;
  END IF;

  IF OLD.title IS DISTINCT FROM NEW.title THEN
    INSERT INTO activity_log (task_id, subtask_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.task_id, NEW.id, auth.uid(), 'updated', 'title', OLD.title, NEW.title);
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO activity_log (task_id, subtask_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.task_id, NEW.id, auth.uid(), 'updated', 'status', OLD.status, NEW.status);
  END IF;

  IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
    INSERT INTO activity_log (task_id, subtask_id, user_id, action, field_name, old_value, new_value)
    VALUES (
      NEW.task_id,
      NEW.id,
      auth.uid(),
      'updated',
      'assignee_id',
      OLD.assignee_id::text,
      NEW.assignee_id::text
    );
  END IF;

  IF OLD.tester_id IS DISTINCT FROM NEW.tester_id THEN
    INSERT INTO activity_log (task_id, subtask_id, user_id, action, field_name, old_value, new_value)
    VALUES (
      NEW.task_id,
      NEW.id,
      auth.uid(),
      'updated',
      'tester_id',
      OLD.tester_id::text,
      NEW.tester_id::text
    );
  END IF;

  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    INSERT INTO activity_log (task_id, subtask_id, user_id, action, field_name, old_value, new_value)
    VALUES (
      NEW.task_id,
      NEW.id,
      auth.uid(),
      'updated',
      'due_date',
      OLD.due_date::text,
      NEW.due_date::text
    );
  END IF;

  IF OLD.estimate_hours IS DISTINCT FROM NEW.estimate_hours THEN
    INSERT INTO activity_log (task_id, subtask_id, user_id, action, field_name, old_value, new_value)
    VALUES (
      NEW.task_id,
      NEW.id,
      auth.uid(),
      'updated',
      'estimate_hours',
      OLD.estimate_hours::text,
      NEW.estimate_hours::text
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subtasks_activity_log ON subtasks;
CREATE TRIGGER subtasks_activity_log
  AFTER INSERT OR UPDATE ON subtasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_subtask_changes();

-- -----------------------------------------------------------------------------
-- Assignment notify only (activity rows come from log_subtask_changes)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_subtask_assignment()
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
  meta jsonb;
  msg text;
BEGIN
  actor_id := auth.uid();
  actor_name := public.profile_display_name(actor_id);

  SELECT title, project_id INTO task_title, task_project_id
  FROM tasks
  WHERE id = NEW.task_id;

  IF task_title IS NULL THEN
    task_title := 'Task';
  END IF;

  meta := jsonb_build_object(
    'project_id', task_project_id,
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
$$;

DROP TRIGGER IF EXISTS subtasks_assignment_notify ON subtasks;
CREATE TRIGGER subtasks_assignment_notify
  AFTER INSERT OR UPDATE OF assignee_id, tester_id ON subtasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_subtask_assignment();

-- -----------------------------------------------------------------------------
-- Skip activity→notification for any subtask-scoped log row
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
