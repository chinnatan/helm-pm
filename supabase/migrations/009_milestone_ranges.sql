-- Helm PM: Migration 009 — milestone date ranges

ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS due_date DATE;

UPDATE milestones
SET
  start_date = COALESCE(start_date, date),
  due_date = COALESCE(due_date, date)
WHERE start_date IS NULL OR due_date IS NULL;

ALTER TABLE milestones
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN due_date SET NOT NULL;

-- Keep legacy `date` in sync with due_date for older clients
CREATE OR REPLACE FUNCTION sync_milestone_legacy_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.date := NEW.due_date;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS milestones_sync_date ON milestones;
CREATE TRIGGER milestones_sync_date
  BEFORE INSERT OR UPDATE OF due_date ON milestones
  FOR EACH ROW EXECUTE FUNCTION sync_milestone_legacy_date();

UPDATE milestones SET date = due_date WHERE date IS DISTINCT FROM due_date;
