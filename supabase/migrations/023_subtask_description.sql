-- Subtasks: rich-text description like parent tasks

ALTER TABLE subtasks
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN subtasks.description IS 'Optional rich-text description for this subtask';
