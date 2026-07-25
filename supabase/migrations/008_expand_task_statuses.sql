-- Helm PM: Migration 008 — expand task statuses for QA workflow
-- blocked → cancelled; add ready_for_test, testing, release

-- Drop old check (Postgres names unnamed checks as {table}_{column}_check)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Migrate legacy value
UPDATE tasks SET status = 'cancelled' WHERE status = 'blocked';

ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN (
    'todo',
    'in_progress',
    'ready_for_test',
    'testing',
    'done',
    'release',
    'cancelled'
  ));
