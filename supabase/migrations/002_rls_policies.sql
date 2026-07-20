-- =============================================================================
-- Helm PM: Migration 002 — Row Level Security (RLS)
-- =============================================================================
-- RLS บังคับสิทธิ์ที่ระดับแถวในฐานข้อมูล
-- แม้ client จะ query ตรงจาก frontend ก็ไม่เห็นข้อมูลข้าม workspace
-- ใช้ auth.uid() ระบุ user ที่ login อยู่

-- =============================================================================
-- ฟังก์ชันช่วย (Helper functions)
-- =============================================================================

-- ตรวจว่า user ปัจจุบันเป็นสมาชิกของ workspace นี้หรือไม่
-- ใช้ใน policy เกือบทุกตาราง
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
$$;

-- ตรวจว่า user มีสิทธิ์เขียน (ไม่ใช่ viewer)
-- admin, manager, member = เขียนได้ | viewer = อ่านอย่างเดียว
CREATE OR REPLACE FUNCTION can_write_workspace(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'manager', 'member')
  );
$$;

-- หา workspace_id จาก project_id (ใช้ใน policy ของ tasks, milestones)
CREATE OR REPLACE FUNCTION project_workspace_id(p_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT workspace_id FROM projects WHERE id = p_id;
$$;

-- หา workspace_id จาก task_id (ใช้ใน policy ของ subtasks, comments, ฯลฯ)
CREATE OR REPLACE FUNCTION task_workspace_id(t_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.workspace_id
  FROM tasks t
  JOIN projects p ON p.id = t.project_id
  WHERE t.id = t_id;
$$;

-- =============================================================================
-- profiles — โปรไฟล์ผู้ใช้
-- =============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ดูได้: ตัวเอง หรือคนที่อยู่ workspace เดียวกัน (สำหรับแสดง assignee)
CREATE POLICY "Users can view profiles in same workspace"
  ON profiles FOR SELECT
  USING (
    id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM workspace_members wm1
      JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.user_id = auth.uid() AND wm2.user_id = profiles.id
    )
  );

-- แก้ได้เฉพาะโปรไฟล์ตัวเอง
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- =============================================================================
-- workspaces — พื้นที่ทำงาน
-- =============================================================================
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- สมาชิกเท่านั้นที่เห็น workspace
CREATE POLICY "Members can view workspace"
  ON workspaces FOR SELECT
  USING (is_workspace_member(id));

-- เฉพาะ admin แก้ชื่อ workspace ได้
CREATE POLICY "Admins can update workspace"
  ON workspaces FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================================================
-- workspace_members — สมาชิกทีม
-- =============================================================================
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- สมาชิกเห็นรายชื่อคนในทีมได้
CREATE POLICY "Members can view workspace members"
  ON workspace_members FOR SELECT
  USING (is_workspace_member(workspace_id));

-- เฉพาะ admin เชิญ/ลบ/เปลี่ยน role สมาชิกได้
CREATE POLICY "Admins can manage members"
  ON workspace_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
  );

-- =============================================================================
-- projects — โปรเจกต์
-- =============================================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- สมาชิกดูโปรเจกต์ใน workspace ได้
CREATE POLICY "Members can view projects"
  ON projects FOR SELECT
  USING (is_workspace_member(workspace_id));

-- member ขึ้นไปสร้างโปรเจกต์ได้
CREATE POLICY "Writers can create projects"
  ON projects FOR INSERT
  WITH CHECK (can_write_workspace(workspace_id));

-- member ขึ้นไปแก้โปรเจกต์ได้
CREATE POLICY "Writers can update projects"
  ON projects FOR UPDATE
  USING (can_write_workspace(workspace_id));

-- เฉพาะ admin/manager ลบ (archive) โปรเจกต์ได้
CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = projects.workspace_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'manager')
    )
  );

-- =============================================================================
-- labels — ป้ายกำกับ
-- =============================================================================
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view labels"
  ON labels FOR SELECT
  USING (is_workspace_member(workspace_id));

-- member ขึ้นไปสร้าง/แก้/ลบ label ได้
CREATE POLICY "Writers can manage labels"
  ON labels FOR ALL
  USING (can_write_workspace(workspace_id));

-- =============================================================================
-- tasks — งานหลัก
-- =============================================================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- สมาชิกดู task ในโปรเจกต์ของ workspace ตัวเองได้
CREATE POLICY "Members can view tasks"
  ON tasks FOR SELECT
  USING (is_workspace_member(project_workspace_id(project_id)));

CREATE POLICY "Writers can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (can_write_workspace(project_workspace_id(project_id)));

CREATE POLICY "Writers can update tasks"
  ON tasks FOR UPDATE
  USING (can_write_workspace(project_workspace_id(project_id)));

-- เฉพาะ admin/manager ลบ task ได้
CREATE POLICY "Managers can delete tasks"
  ON tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      JOIN projects p ON p.workspace_id = wm.workspace_id
      WHERE p.id = tasks.project_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('admin', 'manager')
    )
  );

-- =============================================================================
-- subtasks — งานย่อย
-- =============================================================================
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view subtasks"
  ON subtasks FOR SELECT
  USING (is_workspace_member(task_workspace_id(task_id)));

CREATE POLICY "Writers can manage subtasks"
  ON subtasks FOR ALL
  USING (can_write_workspace(task_workspace_id(task_id)));

-- =============================================================================
-- task_labels — การเชื่อม task กับ label
-- =============================================================================
ALTER TABLE task_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view task labels"
  ON task_labels FOR SELECT
  USING (is_workspace_member(task_workspace_id(task_id)));

CREATE POLICY "Writers can manage task labels"
  ON task_labels FOR ALL
  USING (can_write_workspace(task_workspace_id(task_id)));

-- =============================================================================
-- comments — ความคิดเห็น
-- =============================================================================
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view comments"
  ON comments FOR SELECT
  USING (is_workspace_member(task_workspace_id(task_id)));

-- สร้าง comment ได้ถ้าเป็นสมาชิก และ user_id ต้องเป็นตัวเอง
CREATE POLICY "Writers can create comments"
  ON comments FOR INSERT
  WITH CHECK (
    can_write_workspace(task_workspace_id(task_id)) AND user_id = auth.uid()
  );

-- ลบได้เฉพาะ comment ของตัวเอง
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================================
-- activity_log — ประวัติการเปลี่ยนแปลง (อ่านอย่างเดียวจาก client)
-- =============================================================================
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view activity"
  ON activity_log FOR SELECT
  USING (is_workspace_member(task_workspace_id(task_id)));

-- =============================================================================
-- user_task_preferences — การตั้งค่า My Planner ส่วนตัว
-- =============================================================================
ALTER TABLE user_task_preferences ENABLE ROW LEVEL SECURITY;

-- จัดการ preference ของตัวเองเท่านั้น (pin, ลำดับ, scheduled_date)
CREATE POLICY "Users can manage own preferences"
  ON user_task_preferences FOR ALL
  USING (user_id = auth.uid());

-- =============================================================================
-- task_dependencies — ความสัมพันธ์งาน (Gantt)
-- =============================================================================
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view dependencies"
  ON task_dependencies FOR SELECT
  USING (is_workspace_member(task_workspace_id(task_id)));

CREATE POLICY "Writers can manage dependencies"
  ON task_dependencies FOR ALL
  USING (can_write_workspace(task_workspace_id(task_id)));

-- =============================================================================
-- milestones — จุดสำคัญบน timeline
-- =============================================================================
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view milestones"
  ON milestones FOR SELECT
  USING (is_workspace_member(project_workspace_id(project_id)));

CREATE POLICY "Writers can manage milestones"
  ON milestones FOR ALL
  USING (can_write_workspace(project_workspace_id(project_id)));

-- =============================================================================
-- notifications — การแจ้งเตือน (ส่วนตัว ไม่แชร์ข้าม user)
-- =============================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- อัปเดตได้เฉพาะของตัวเอง (เช่น mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- =============================================================================
-- attachments — ไฟล์แนบ
-- =============================================================================
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view attachments"
  ON attachments FOR SELECT
  USING (is_workspace_member(task_workspace_id(task_id)));

CREATE POLICY "Writers can manage attachments"
  ON attachments FOR ALL
  USING (can_write_workspace(task_workspace_id(task_id)));
