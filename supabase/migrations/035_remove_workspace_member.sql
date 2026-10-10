-- Helm PM: Migration 035 — Remove / Leave workspace member
-- ADR 0002: ลบแถว workspace_members จริง (ไม่ soft delete) ใน RPC เดียวแบบ atomic
-- 1) trigger กัน admin คนสุดท้าย (ครอบคลุมทางลัดที่ไม่ผ่าน RPC)
-- 2) remove_workspace_member(): โอน/เคลียร์งานค้าง + focus แล้วลบสมาชิก
-- ไม่มีการเปลี่ยน schema ของตาราง — rollback = DROP FUNCTION/TRIGGER ด้านล่าง

-- -----------------------------------------------------------------------------
-- กัน admin คนสุดท้ายถูกลบ/ลด role
-- ข้ามเมื่อทั้ง workspace กำลังถูกลบ (cascade) เพื่อไม่ให้ลบ workspace ไม่ได้
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_last_workspace_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF OLD.role <> 'admin' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.role = 'admin' THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = OLD.workspace_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = OLD.workspace_id
      AND role = 'admin'
      AND id <> OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot remove the last admin of a workspace'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS workspace_members_protect_last_admin ON public.workspace_members;
CREATE TRIGGER workspace_members_protect_last_admin
  BEFORE DELETE OR UPDATE OF role ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_workspace_admin();

-- -----------------------------------------------------------------------------
-- remove_workspace_member
-- p_transfer_to NULL = ปล่อยงานว่าง (ไม่เปลี่ยน status)
-- caller ต้องเป็น admin ของ workspace หรือเป็นคนที่ถูกนำออกเอง (Leave)
-- คืนจำนวนงานที่โอน/เคลียร์
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid,
  p_transfer_to uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_count integer := 0;
  v_n integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.is_workspace_admin(p_workspace_id) OR v_actor = p_user_id) THEN
    RAISE EXCEPTION 'Only admins can remove members' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Member not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_transfer_to IS NOT NULL AND (
    p_transfer_to = p_user_id
    OR NOT EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = p_workspace_id
        AND user_id = p_transfer_to
        AND role IN ('admin', 'manager', 'member')
    )
  ) THEN
    RAISE EXCEPTION 'Invalid transfer target' USING ERRCODE = '22023';
  END IF;

  UPDATE public.tasks SET assignee_id = p_transfer_to
  WHERE workspace_id = p_workspace_id AND assignee_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_count := v_count + v_n;

  UPDATE public.tasks SET tester_id = p_transfer_to
  WHERE workspace_id = p_workspace_id AND tester_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_count := v_count + v_n;

  UPDATE public.subtasks s SET assignee_id = p_transfer_to
  FROM public.tasks t
  WHERE s.task_id = t.id AND t.workspace_id = p_workspace_id AND s.assignee_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_count := v_count + v_n;

  UPDATE public.subtasks s SET tester_id = p_transfer_to
  FROM public.tasks t
  WHERE s.task_id = t.id AND t.workspace_id = p_workspace_id AND s.tester_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_count := v_count + v_n;

  DELETE FROM public.user_task_preferences p
  USING public.tasks t
  WHERE p.task_id = t.id AND t.workspace_id = p_workspace_id AND p.user_id = p_user_id;

  -- trigger เดิมแจ้งผู้รับโอนทีละงาน → ลบที่เกิดใน transaction นี้ (now() = เวลาเริ่ม txn) แล้วส่งสรุปแทน
  IF p_transfer_to IS NOT NULL AND v_count > 0 THEN
    DELETE FROM public.notifications
    WHERE user_id = p_transfer_to
      AND type IN ('task_assigned', 'task_tester_assigned')
      AND created_at = now();

    PERFORM public.insert_task_notification(
      p_transfer_to,
      v_actor,
      NULL,
      'tasks_transferred',
      format('%s transferred %s item(s) to you', public.profile_display_name(p_user_id), v_count),
      jsonb_build_object('workspace_id', p_workspace_id, 'from_user_id', p_user_id, 'count', v_count)
    );
  END IF;

  -- trigger protect_last_workspace_admin จะ raise ถ้าเป็น admin คนสุดท้าย → ทั้ง txn rollback
  DELETE FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_workspace_member(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_workspace_member(uuid, uuid, uuid) TO authenticated;
