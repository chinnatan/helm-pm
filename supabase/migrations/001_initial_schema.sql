-- =============================================================================
-- Helm PM: Migration 001 — โครงสร้างฐานข้อมูลหลัก
-- =============================================================================
-- ไฟล์นี้สร้างตาราง ฟังก์ชัน trigger และ index ทั้งหมดของระบบ
-- รันครั้งเดียวตอน setup โปรเจกต์ Supabase ใหม่

-- เปิดใช้ extension สำหรับสร้าง UUID แบบสุ่ม (gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- profiles — โปรไฟล์ผู้ใช้ (ขยายจาก auth.users ของ Supabase Auth)
-- เก็บข้อมูลแสดงผล: ชื่อ, อีเมล, รูป avatar
-- id ต้องตรงกับ auth.users.id เสมอ
-- -----------------------------------------------------------------------------
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- workspaces — พื้นที่ทำงาน (tenant ระดับบนสุด)
-- ทีมหนึ่งทีม = workspace หนึ่งอัน
-- ผู้ใช้ใหม่จะได้ workspace ชื่อ "My Workspace" อัตโนมัติ
-- -----------------------------------------------------------------------------
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- workspace_members — สมาชิกใน workspace + บทบาท (role)
-- role: admin (จัดการทุกอย่าง), manager (ลบ task/project ได้),
--       member (สร้าง/แก้งานได้), viewer (อ่านอย่างเดียว)
-- ห้าม user คนเดียวอยู่ใน workspace เดียวกันซ้ำ (UNIQUE)
-- -----------------------------------------------------------------------------
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- -----------------------------------------------------------------------------
-- projects — โปรเจกต์ภายใน workspace
-- แต่ละ project มีสี (color) ใช้แสดงบน UI
-- archived_at ไม่เป็น null = โปรเจกต์ถูก archive แล้ว (soft delete)
-- -----------------------------------------------------------------------------
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#1e3a5f',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- labels — ป้ายกำกับ (tag) ระดับ workspace
-- ใช้จัดกลุ่ม task เช่น Bug, Feature
-- ชื่อ label ห้ามซ้ำใน workspace เดียวกัน
-- -----------------------------------------------------------------------------
CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

-- -----------------------------------------------------------------------------
-- tasks — งานหลัก (single source of truth)
-- ใช้ร่วมกันทั้ง Kanban, List, Gantt และ My Planner
-- status: todo → in_progress → done (หรือ blocked)
-- priority: low / medium / high / urgent
-- sort_order: ลำดับการ์ดบน Kanban (ลากแล้วอัปเดตค่านี้)
-- -----------------------------------------------------------------------------
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- คนรับผิดชอบ
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,    -- คนสร้างงาน
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'blocked')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE,    -- วันครบกำหนด (ใช้ใน My Planner + Gantt)
  start_date DATE,  -- วันเริ่ม (ใช้ใน Gantt)
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- subtasks — งานย่อยภายใน task (checklist)
-- completed = true เมื่อติ๊กเสร็จ
-- -----------------------------------------------------------------------------
CREATE TABLE subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- task_labels — ตารางเชื่อม task กับ label (many-to-many)
-- task หนึ่งงานติด label ได้หลายอัน
-- -----------------------------------------------------------------------------
CREATE TABLE task_labels (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

-- -----------------------------------------------------------------------------
-- comments — ความคิดเห็นใน task
-- รองรับ @mention ผ่านแอป (parse ฝั่ง frontend)
-- -----------------------------------------------------------------------------
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- activity_log — ประวัติการเปลี่ยนแปลง (audit trail)
-- บันทึกอัตโนมัติเมื่อ status, assignee, due_date, priority เปลี่ยน
-- แสดงในแท็บ Activity ของ TaskModal
-- -----------------------------------------------------------------------------
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,       -- เช่น 'created', 'updated'
  field_name TEXT,            -- ฟิลด์ที่เปลี่ยน เช่น 'status'
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- user_task_preferences — การตั้งค่าส่วนตัวของ My Planner
-- ไม่ duplicate task — เก็บแค่ preference ต่อ user ต่อ task
-- is_pinned: แสดงในแท็บ Focus
-- scheduled_date: วางงานลงวันนี้ (ส่วนตัว ไม่กระทบทีม)
-- sort_order: ลำดับใน My Planner
-- -----------------------------------------------------------------------------
CREATE TABLE user_task_preferences (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  scheduled_date DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, task_id)
);

-- -----------------------------------------------------------------------------
-- task_dependencies — ความสัมพันธ์งานต่อเนื่อง (Gantt)
-- task_id ต้องรอ depends_on_task_id เสร็จก่อนถึงจะเริ่มได้
-- ห้าม task พึ่งพาตัวเอง (CHECK)
-- -----------------------------------------------------------------------------
CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, depends_on_task_id),
  CHECK (task_id != depends_on_task_id)
);

-- -----------------------------------------------------------------------------
-- milestones — จุดสำคัญบน timeline (Gantt)
-- แสดงเป็น marker บน Gantt chart
-- -----------------------------------------------------------------------------
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- notifications — การแจ้งเตือนในแอป
-- type: เช่น 'mention', 'assign', 'due_date'
-- read: false = ยังไม่อ่าน (แสดง badge บนกระดิ่ง)
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- attachments — ไฟล์แนบใน task
-- file_url ชี้ไป Supabase Storage bucket "attachments"
-- -----------------------------------------------------------------------------
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  filename TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Indexes — เร่งความเร็ว query ที่ใช้บ่อย
-- =============================================================================
CREATE INDEX idx_tasks_assignee_due ON tasks(assignee_id, due_date);       -- My Planner
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);        -- Kanban filter
CREATE INDEX idx_tasks_project_sort ON tasks(project_id, sort_order);     -- Kanban ลำดับการ์ด
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);    -- หา workspace ของ user
CREATE INDEX idx_projects_workspace ON projects(workspace_id);           -- รายการ project
CREATE INDEX idx_comments_task ON comments(task_id);                     -- โหลด comment
CREATE INDEX idx_activity_log_task ON activity_log(task_id);             -- โหลด activity
CREATE INDEX idx_notifications_user ON notifications(user_id, read);     -- กระดิ่งแจ้งเตือน

-- =============================================================================
-- Trigger: สร้าง profile อัตโนมัติเมื่อ user สมัครผ่าน Supabase Auth
-- ต้อง SECURITY DEFINER + search_path เพราะ Auth รันด้วย supabase_auth_admin
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- Trigger: สร้าง workspace + labels เริ่มต้นเมื่อมี profile ใหม่
-- user คนแรกใน workspace จะเป็น admin
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws_id UUID;
BEGIN
  INSERT INTO public.workspaces (name) VALUES ('My Workspace') RETURNING id INTO ws_id;
  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (ws_id, NEW.id, 'admin');

  -- labels เริ่มต้นสำหรับ workspace ใหม่
  INSERT INTO public.labels (workspace_id, name, color) VALUES
    (ws_id, 'Bug', '#dc2626'),
    (ws_id, 'Feature', '#2563eb'),
    (ws_id, 'Improvement', '#16a34a'),
    (ws_id, 'Documentation', '#7c3aed');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();

-- =============================================================================
-- Trigger: อัปเดต updated_at ทุกครั้งที่แก้ task
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- Trigger: บันทึก activity_log เมื่อสร้างหรือแก้ task
-- ติดตามเฉพาะฟิลด์สำคัญ: status, assignee, due_date, priority
-- =============================================================================
CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'status', OLD.status, NEW.status);
    END IF;
    IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'assignee_id', OLD.assignee_id::text, NEW.assignee_id::text);
    END IF;
    IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'due_date', OLD.due_date::text, NEW.due_date::text);
    END IF;
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'priority', OLD.priority, NEW.priority);
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (task_id, user_id, action)
    VALUES (NEW.id, auth.uid(), 'created');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tasks_activity_log
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_task_changes();

-- =============================================================================
-- Realtime — เปิดให้ Supabase Realtime sync ข้าม client
-- tasks: Kanban อัปเดต live เมื่อคนอื่นลากการ์ด
-- comments / notifications: แจ้งเตือนทันที
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
