-- Subtasks: kanban status (separate board cards)

ALTER TABLE subtasks
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo';

UPDATE subtasks s
SET status = CASE
  WHEN s.completed THEN 'done'
  ELSE COALESCE(
    (SELECT t.status FROM tasks t WHERE t.id = s.task_id),
    'todo'
  )
END;

ALTER TABLE subtasks DROP CONSTRAINT IF EXISTS subtasks_status_check;
ALTER TABLE subtasks
  ADD CONSTRAINT subtasks_status_check
  CHECK (status IN (
    'backlog',
    'todo',
    'in_progress',
    'ready_for_test',
    'testing',
    'done',
    'release',
    'cancelled'
  ));

CREATE INDEX IF NOT EXISTS subtasks_status_idx ON subtasks(status);

COMMENT ON COLUMN subtasks.status IS 'Kanban column status for this subtask as its own board card';

CREATE OR REPLACE FUNCTION public.sync_subtask_completed_from_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.completed := NEW.status IN ('done', 'release', 'cancelled');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subtasks_sync_completed ON subtasks;
CREATE TRIGGER subtasks_sync_completed
  BEFORE INSERT OR UPDATE OF status ON subtasks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_subtask_completed_from_status();
