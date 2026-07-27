-- Per-user task card display density (compact | standard | detailed)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS task_card_density text NOT NULL DEFAULT 'standard'
  CHECK (task_card_density IN ('compact', 'standard', 'detailed'));
