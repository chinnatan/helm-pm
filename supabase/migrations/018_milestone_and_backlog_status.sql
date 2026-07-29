-- Helm PM: Migration 018 — milestone status + Kanban backlog

-- milestones.status
ALTER TABLE milestones
  ADD COLUMN status TEXT NOT NULL DEFAULT 'planned'
  CHECK (status IN ('planned', 'in_progress', 'done', 'cancelled'));

-- Expand task statuses with backlog (leftmost Kanban column)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
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
