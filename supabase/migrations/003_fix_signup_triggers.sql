-- =============================================================================
-- Helm PM: Migration 003 — แก้ signup trigger + RLS ที่บล็อกสร้าง user
-- =============================================================================
-- อาการ: {"code":"unexpected_failure","message":"Database error saving new user"}
-- สาเหตุ: trigger บน auth.users / profiles ล้ม (มักเพราะ search_path / RLS)
-- ดู error จริงได้ที่ Dashboard → Logs → Postgres Logs

-- -----------------------------------------------------------------------------
-- 1) แก้ helper ให้มี search_path ชัดเจน (กัน recursion / schema ผิด)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_workspace(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'manager', 'member')
  );
$$;

CREATE OR REPLACE FUNCTION public.project_workspace_id(p_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT workspace_id FROM public.projects WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.task_workspace_id(t_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.workspace_id
  FROM public.tasks t
  JOIN public.projects p ON p.id = t.project_id
  WHERE t.id = t_id;
$$;

-- -----------------------------------------------------------------------------
-- 2) แก้ trigger สร้าง profile — ต้อง SECURITY DEFINER + search_path
--    เพราะ Auth รันด้วย role supabase_auth_admin ซึ่งไม่มีสิทธิ์บน public.*
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 3) แก้ trigger สร้าง workspace เริ่มต้น
--    เดิมไม่มี INSERT policy บน workspaces และสมาชิกคนแรกติด chicken-egg
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws_id UUID;
BEGIN
  INSERT INTO public.workspaces (name)
  VALUES ('My Workspace')
  RETURNING id INTO ws_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (ws_id, NEW.id, 'admin');

  INSERT INTO public.labels (workspace_id, name, color) VALUES
    (ws_id, 'Bug', '#dc2626'),
    (ws_id, 'Feature', '#2563eb'),
    (ws_id, 'Improvement', '#16a34a'),
    (ws_id, 'Documentation', '#7c3aed');

  RETURN NEW;
END;
$$;

-- ให้ฟังก์ชันเป็นของ postgres เพื่อ bypass RLS ตอน trigger รัน
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
ALTER FUNCTION public.handle_new_profile() OWNER TO postgres;
ALTER FUNCTION public.is_workspace_member(UUID) OWNER TO postgres;
ALTER FUNCTION public.can_write_workspace(UUID) OWNER TO postgres;
ALTER FUNCTION public.project_workspace_id(UUID) OWNER TO postgres;
ALTER FUNCTION public.task_workspace_id(UUID) OWNER TO postgres;

-- -----------------------------------------------------------------------------
-- 4) เติม policy ที่ขาด — กันกรณี client / edge case อื่น
-- -----------------------------------------------------------------------------

-- profiles: อนุญาตให้ระบบสร้างแถวตอน signup (trigger เป็นหลัก แต่มี policy ไว้ด้วย)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- workspaces: ยังไม่มี INSERT — สมาชิกใหม่สร้าง workspace ผ่าน trigger เป็นหลัก
-- เพิ่ม policy ให้ authenticated สร้างได้ (เผื่ออนาคต)
DROP POLICY IF EXISTS "Authenticated users can create workspace" ON public.workspaces;
CREATE POLICY "Authenticated users can create workspace"
  ON public.workspaces FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- workspace_members: คนแรกสมัครเป็น admin ของตัวเองได้ (แก้ chicken-egg)
DROP POLICY IF EXISTS "Users can join as first member" ON public.workspace_members;
CREATE POLICY "Users can join as first member"
  ON public.workspace_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      -- เป็น admin ของ workspace อยู่แล้ว หรือยังไม่มีสมาชิกเลย
      EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = workspace_members.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role = 'admin'
      )
      OR NOT EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = workspace_members.workspace_id
      )
    )
  );
