-- Subtasks: per-item assignee, tester, estimate, due date + assign notifications

ALTER TABLE subtasks
  ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tester_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimate_hours NUMERIC
    CHECK (estimate_hours IS NULL OR estimate_hours > 0),
  ADD COLUMN IF NOT EXISTS due_date DATE;

CREATE INDEX IF NOT EXISTS subtasks_assignee_id_idx ON subtasks(assignee_id);
CREATE INDEX IF NOT EXISTS subtasks_tester_id_idx ON subtasks(tester_id);
CREATE INDEX IF NOT EXISTS subtasks_due_date_idx ON subtasks(due_date);

COMMENT ON COLUMN subtasks.assignee_id IS 'Developer assigned to this subtask';
COMMENT ON COLUMN subtasks.tester_id IS 'Tester assigned to this subtask';
COMMENT ON COLUMN subtasks.estimate_hours IS 'Optional estimate for this subtask; capacity uses this when assignee is set';
COMMENT ON COLUMN subtasks.due_date IS 'Optional due date for this subtask';

-- -----------------------------------------------------------------------------
-- Skip duplicate notifications from activity_log for subtask assignment fields
-- (subtask trigger below inserts notifications directly)
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

  -- Subtask assignment notifications are handled by notify_on_subtask_assignment
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

-- -----------------------------------------------------------------------------
-- Notify + activity when subtask assignee / tester changes
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
    INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
    VALUES (
      NEW.task_id,
      actor_id,
      'updated',
      'subtask_assignee_id',
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.assignee_id::text ELSE NULL END,
      NEW.assignee_id::text
    );

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
        meta || jsonb_build_object('field', 'subtask_assignee_id')
      );
    END IF;
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.tester_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND OLD.tester_id IS DISTINCT FROM NEW.tester_id) THEN
    INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
    VALUES (
      NEW.task_id,
      actor_id,
      'updated',
      'subtask_tester_id',
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.tester_id::text ELSE NULL END,
      NEW.tester_id::text
    );

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
        meta || jsonb_build_object('field', 'subtask_tester_id')
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
