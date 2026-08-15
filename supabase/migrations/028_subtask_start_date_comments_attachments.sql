-- Subtask start_date (date range like parent tasks) + comments/attachments scoped to subtasks

ALTER TABLE subtasks
  ADD COLUMN IF NOT EXISTS start_date DATE;

CREATE INDEX IF NOT EXISTS subtasks_start_date_idx ON subtasks(start_date);

COMMENT ON COLUMN subtasks.start_date IS 'Optional start date for this subtask (Gantt / calendar range)';

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS subtask_id UUID REFERENCES subtasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS comments_subtask_id_idx ON comments(subtask_id);

COMMENT ON COLUMN comments.subtask_id IS 'When set, comment belongs to this subtask; task_id remains the parent';

ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS subtask_id UUID REFERENCES subtasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS attachments_subtask_id_idx ON attachments(subtask_id);

COMMENT ON COLUMN attachments.subtask_id IS 'When set, attachment belongs to this subtask; task_id remains the parent';

-- Log start_date changes (keep reparent + other fields from 027)
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

  IF OLD.task_id IS DISTINCT FROM NEW.task_id THEN
    INSERT INTO activity_log (task_id, subtask_id, user_id, action, field_name, old_value, new_value)
    VALUES (
      NEW.task_id,
      NEW.id,
      auth.uid(),
      'updated',
      'task_id',
      OLD.task_id::text,
      NEW.task_id::text
    );
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

  IF OLD.start_date IS DISTINCT FROM NEW.start_date THEN
    INSERT INTO activity_log (task_id, subtask_id, user_id, action, field_name, old_value, new_value)
    VALUES (
      NEW.task_id,
      NEW.id,
      auth.uid(),
      'updated',
      'start_date',
      OLD.start_date::text,
      NEW.start_date::text
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
