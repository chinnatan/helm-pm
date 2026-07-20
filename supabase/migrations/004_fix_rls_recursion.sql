-- =============================================================================
-- Helm PM: Migration 004 — แก้ infinite recursion บน workspace_members
-- =============================================================================
-- สาเหตุ: policy ของ workspace_members ไป SELECT ตารางตัวเองซ้ำ
-- (เช่น "Admins can manage members", "Users can join as first member")
-- แก้: ย้าย logic ไปฟังก์ชัน SECURITY DEFINER ที่ปิด row_security

-- -----------------------------------------------------------------------------
-- Helper ที่ query workspace_members โดยไม่โดน RLS (กัน recursion)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
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
SET row_security = off
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'manager', 'member')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_manager(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'manager')
  );
$$;

-- ใช้ใน policy ดูโปรไฟล์เพื่อนร่วม workspace (ไม่ join workspace_members ตรงๆ)
CREATE OR REPLACE FUNCTION public.shares_workspace_with(other_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members me
    JOIN public.workspace_members them
      ON them.workspace_id = me.workspace_id
    WHERE me.user_id = auth.uid()
      AND them.user_id = other_user_id
  );
$$;

-- ตรวจว่า workspace ยังไม่มีสมาชิก (สำหรับ join คนแรก)
CREATE OR REPLACE FUNCTION public.workspace_has_no_members(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.workspace_members WHERE workspace_id = ws_id
  );
$$;

ALTER FUNCTION public.is_workspace_member(UUID) OWNER TO postgres;
ALTER FUNCTION public.can_write_workspace(UUID) OWNER TO postgres;
ALTER FUNCTION public.is_workspace_admin(UUID) OWNER TO postgres;
ALTER FUNCTION public.is_workspace_manager(UUID) OWNER TO postgres;
ALTER FUNCTION public.shares_workspace_with(UUID) OWNER TO postgres;
ALTER FUNCTION public.workspace_has_no_members(UUID) OWNER TO postgres;

-- -----------------------------------------------------------------------------
-- ลบ policy ที่ query workspace_members ตรงๆ แล้วสร้างใหม่ด้วย helper
-- -----------------------------------------------------------------------------

-- workspace_members
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can manage members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can join as first member" ON public.workspace_members;

CREATE POLICY "Members can view workspace members"
  ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Admins can insert members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    public.is_workspace_admin(workspace_id)
    OR (
      -- คนแรกของ workspace (หรือ trigger signup)
      user_id = auth.uid()
      AND public.workspace_has_no_members(workspace_id)
    )
  );

CREATE POLICY "Admins can update members"
  ON public.workspace_members FOR UPDATE
  USING (public.is_workspace_admin(workspace_id));

CREATE POLICY "Admins can delete members"
  ON public.workspace_members FOR DELETE
  USING (public.is_workspace_admin(workspace_id));

-- workspaces: update ใช้ helper แทน subquery ตรงๆ
DROP POLICY IF EXISTS "Admins can update workspace" ON public.workspaces;
CREATE POLICY "Admins can update workspace"
  ON public.workspaces FOR UPDATE
  USING (public.is_workspace_admin(id));

-- profiles: ไม่ join workspace_members ตรงๆ
DROP POLICY IF EXISTS "Users can view profiles in same workspace" ON public.profiles;
CREATE POLICY "Users can view profiles in same workspace"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR public.shares_workspace_with(id)
  );

-- projects / tasks delete: ไม่ subquery workspace_members ตรงๆ
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;
CREATE POLICY "Admins can delete projects"
  ON public.projects FOR DELETE
  USING (public.is_workspace_manager(workspace_id));

DROP POLICY IF EXISTS "Managers can delete tasks" ON public.tasks;
CREATE POLICY "Managers can delete tasks"
  ON public.tasks FOR DELETE
  USING (public.is_workspace_manager(public.project_workspace_id(project_id)));
