-- Helm PM: Migration 032 — Team focus
-- Focus (pin) ของแต่ละคนอยู่ใน user_task_preferences อยู่แล้ว (My Planner) ให้สมาชิก workspace
-- เดียวกันอ่านของคนอื่นได้ เพื่อแสดงหน้า "ทีมกำลังทำอะไร" — การเขียนยังจำกัดเฉพาะเจ้าของแถวตาม policy เดิม
CREATE POLICY "Workspace members can view preferences"
  ON user_task_preferences FOR SELECT
  USING (is_workspace_member(task_workspace_id(task_id)));
