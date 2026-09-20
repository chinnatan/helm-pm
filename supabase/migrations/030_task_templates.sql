-- Helm PM: Migration 030 — เทมเพลตงานระดับ workspace
CREATE TABLE task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('backlog', 'todo', 'in_progress', 'ready_for_test', 'testing', 'done', 'release', 'cancelled')),
  phase TEXT
    CHECK (phase IS NULL OR phase IN ('requirements', 'analysis', 'design', 'development', 'testing', 'deployment', 'done')),
  estimate_hours NUMERIC CHECK (estimate_hours IS NULL OR estimate_hours > 0),
  label_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX task_templates_workspace_id_idx ON task_templates(workspace_id);

ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view task templates"
  ON task_templates FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Writers can manage task templates"
  ON task_templates FOR ALL
  USING (can_write_workspace(workspace_id));

CREATE TRIGGER task_templates_updated_at
  BEFORE UPDATE ON task_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON task_templates TO authenticated;
GRANT SELECT ON task_templates TO anon;
GRANT ALL ON task_templates TO service_role;
