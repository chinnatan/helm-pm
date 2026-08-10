-- Log subtask reparent (task_id change) in activity_log

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
