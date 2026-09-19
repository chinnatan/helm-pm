-- Subtask labels: same workspace labels as tasks via junction table

CREATE TABLE IF NOT EXISTS subtask_labels (
  subtask_id UUID NOT NULL REFERENCES subtasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (subtask_id, label_id)
);

CREATE INDEX IF NOT EXISTS subtask_labels_label_id_idx ON subtask_labels(label_id);

ALTER TABLE subtask_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view subtask labels"
  ON subtask_labels FOR SELECT
  USING (
    is_workspace_member(
      task_workspace_id((SELECT task_id FROM subtasks WHERE id = subtask_id))
    )
  );

CREATE POLICY "Writers can manage subtask labels"
  ON subtask_labels FOR ALL
  USING (
    can_write_workspace(
      task_workspace_id((SELECT task_id FROM subtasks WHERE id = subtask_id))
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON subtask_labels TO authenticated;
GRANT SELECT ON subtask_labels TO anon;
GRANT ALL ON subtask_labels TO service_role;
