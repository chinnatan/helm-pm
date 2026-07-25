-- Helm PM: Migration 007 — task milestone/tester + member job_role

-- -----------------------------------------------------------------------------
-- tasks: link to milestone + tester assignee
-- -----------------------------------------------------------------------------
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tester_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_milestone_id_idx ON tasks(milestone_id);
CREATE INDEX IF NOT EXISTS tasks_tester_id_idx ON tasks(tester_id);

-- -----------------------------------------------------------------------------
-- workspace_members: job role (function) separate from permission role
-- -----------------------------------------------------------------------------
ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS job_role TEXT
    CHECK (job_role IS NULL OR job_role IN ('developer', 'tester', 'designer', 'pm', 'other'));

-- -----------------------------------------------------------------------------
-- Activity log: also track tester_id and milestone_id changes
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS TRIGGER AS $$
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
    IF OLD.milestone_id IS DISTINCT FROM NEW.milestone_id THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'milestone_id', OLD.milestone_id::text, NEW.milestone_id::text);
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
