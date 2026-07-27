-- =============================================================================
-- 015_team_capacity.sql
-- Team capacity / burn-rate: weekly baseline, estimates, monthly calendar,
-- per-member month hours, notification insert policy, and audit events
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Columns
-- -----------------------------------------------------------------------------
ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS weekly_capacity_hours NUMERIC NOT NULL DEFAULT 32
  CHECK (weekly_capacity_hours >= 8 AND weekly_capacity_hours <= 60);

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS estimate_hours NUMERIC
  CHECK (estimate_hours IS NULL OR estimate_hours > 0);

COMMENT ON COLUMN workspace_members.weekly_capacity_hours IS
  'Planned workable hours per week for capacity / burn-rate views';
COMMENT ON COLUMN tasks.estimate_hours IS
  'Optional effort estimate in hours; null means use priority default in app';

-- -----------------------------------------------------------------------------
-- Notifications: workspace writers can notify other members
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Writers can insert notifications for workspace members"
  ON notifications;

CREATE POLICY "Writers can insert notifications for workspace members"
  ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM workspace_members actor
      JOIN workspace_members target
        ON actor.workspace_id = target.workspace_id
      WHERE actor.user_id = auth.uid()
        AND target.user_id = notifications.user_id
        AND actor.role IN ('admin', 'manager', 'member')
    )
  );

-- -----------------------------------------------------------------------------
-- member_month_capacities — per-person monthly hour overrides
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member_month_capacities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month_start DATE NOT NULL,
  hours NUMERIC NOT NULL CHECK (hours >= 0 AND hours <= 400),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, month_start),
  CHECK (month_start = date_trunc('month', month_start)::date)
);

CREATE INDEX IF NOT EXISTS idx_member_month_capacities_ws_month
  ON member_month_capacities(workspace_id, month_start);

COMMENT ON TABLE member_month_capacities IS
  'Optional monthly workable hours per member; empty means derive from calendar / weekly baseline';

ALTER TABLE member_month_capacities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view month capacities" ON member_month_capacities;
CREATE POLICY "Members can view month capacities"
  ON member_month_capacities FOR SELECT
  USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Managers can insert month capacities" ON member_month_capacities;
CREATE POLICY "Managers can insert month capacities"
  ON member_month_capacities FOR INSERT
  WITH CHECK (public.is_workspace_manager(workspace_id));

DROP POLICY IF EXISTS "Managers can update month capacities" ON member_month_capacities;
CREATE POLICY "Managers can update month capacities"
  ON member_month_capacities FOR UPDATE
  USING (public.is_workspace_manager(workspace_id));

DROP POLICY IF EXISTS "Managers can delete month capacities" ON member_month_capacities;
CREATE POLICY "Managers can delete month capacities"
  ON member_month_capacities FOR DELETE
  USING (public.is_workspace_manager(workspace_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON member_month_capacities TO authenticated;

-- -----------------------------------------------------------------------------
-- workspace_month_calendars — shared team deductions per month
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_month_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  month_start DATE NOT NULL,
  working_days NUMERIC CHECK (working_days IS NULL OR (working_days >= 0 AND working_days <= 31)),
  holiday_days NUMERIC NOT NULL DEFAULT 0 CHECK (holiday_days >= 0 AND holiday_days <= 31),
  meeting_days NUMERIC NOT NULL DEFAULT 0 CHECK (meeting_days >= 0 AND meeting_days <= 31),
  company_event_days NUMERIC NOT NULL DEFAULT 0 CHECK (company_event_days >= 0 AND company_event_days <= 31),
  leave_days NUMERIC NOT NULL DEFAULT 0 CHECK (leave_days >= 0 AND leave_days <= 31),
  hours_per_day NUMERIC NOT NULL DEFAULT 8 CHECK (hours_per_day > 0 AND hours_per_day <= 24),
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, month_start),
  CHECK (month_start = date_trunc('month', month_start)::date)
);

CREATE INDEX IF NOT EXISTS idx_workspace_month_calendars_ws_month
  ON public.workspace_month_calendars(workspace_id, month_start);

COMMENT ON TABLE public.workspace_month_calendars IS
  'Shared monthly deductions (holidays, meetings, events, leave) for team burn capacity';

ALTER TABLE public.workspace_month_calendars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view month calendars" ON public.workspace_month_calendars;
CREATE POLICY "Members can view month calendars"
  ON public.workspace_month_calendars FOR SELECT
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Managers can insert month calendars" ON public.workspace_month_calendars;
CREATE POLICY "Managers can insert month calendars"
  ON public.workspace_month_calendars FOR INSERT
  WITH CHECK (public.is_workspace_manager(workspace_id));

DROP POLICY IF EXISTS "Managers can update month calendars" ON public.workspace_month_calendars;
CREATE POLICY "Managers can update month calendars"
  ON public.workspace_month_calendars FOR UPDATE
  USING (public.is_workspace_manager(workspace_id));

DROP POLICY IF EXISTS "Managers can delete month calendars" ON public.workspace_month_calendars;
CREATE POLICY "Managers can delete month calendars"
  ON public.workspace_month_calendars FOR DELETE
  USING (public.is_workspace_manager(workspace_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_month_calendars TO authenticated;

-- -----------------------------------------------------------------------------
-- Audit: workspace_month_calendars
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_workspace_month_calendars_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_label TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_label := to_char(NEW.month_start, 'YYYY-MM');
    PERFORM public.write_audit_log(
      NEW.workspace_id,
      'capacity_calendar_created',
      'capacity',
      NEW.id,
      v_label,
      jsonb_build_object(
        'month_start', NEW.month_start,
        'working_days', NEW.working_days,
        'holiday_days', NEW.holiday_days,
        'meeting_days', NEW.meeting_days,
        'company_event_days', NEW.company_event_days,
        'leave_days', NEW.leave_days,
        'hours_per_day', NEW.hours_per_day
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_label := to_char(NEW.month_start, 'YYYY-MM');
    PERFORM public.write_audit_log(
      NEW.workspace_id,
      'capacity_calendar_updated',
      'capacity',
      NEW.id,
      v_label,
      jsonb_build_object(
        'month_start', NEW.month_start,
        'old', jsonb_build_object(
          'working_days', OLD.working_days,
          'holiday_days', OLD.holiday_days,
          'meeting_days', OLD.meeting_days,
          'company_event_days', OLD.company_event_days,
          'leave_days', OLD.leave_days,
          'hours_per_day', OLD.hours_per_day
        ),
        'new', jsonb_build_object(
          'working_days', NEW.working_days,
          'holiday_days', NEW.holiday_days,
          'meeting_days', NEW.meeting_days,
          'company_event_days', NEW.company_event_days,
          'leave_days', NEW.leave_days,
          'hours_per_day', NEW.hours_per_day
        )
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_label := to_char(OLD.month_start, 'YYYY-MM');
    PERFORM public.write_audit_log(
      OLD.workspace_id,
      'capacity_calendar_deleted',
      'capacity',
      OLD.id,
      v_label,
      jsonb_build_object('month_start', OLD.month_start)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

ALTER FUNCTION public.audit_workspace_month_calendars_changes() OWNER TO postgres;

DROP TRIGGER IF EXISTS workspace_month_calendars_audit_log ON public.workspace_month_calendars;
CREATE TRIGGER workspace_month_calendars_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.workspace_month_calendars
  FOR EACH ROW EXECUTE FUNCTION public.audit_workspace_month_calendars_changes();

-- -----------------------------------------------------------------------------
-- Audit: member_month_capacities
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_member_month_capacities_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_label TEXT;
  v_email TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = NEW.user_id;
    v_label := coalesce(v_email, NEW.user_id::text) || ' · ' || to_char(NEW.month_start, 'YYYY-MM');
    PERFORM public.write_audit_log(
      NEW.workspace_id,
      'member_month_hours_set',
      'capacity',
      NEW.id,
      v_label,
      jsonb_build_object(
        'user_id', NEW.user_id,
        'month_start', NEW.month_start,
        'hours', NEW.hours
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.hours IS DISTINCT FROM NEW.hours THEN
      SELECT email INTO v_email FROM public.profiles WHERE id = NEW.user_id;
      v_label := coalesce(v_email, NEW.user_id::text) || ' · ' || to_char(NEW.month_start, 'YYYY-MM');
      PERFORM public.write_audit_log(
        NEW.workspace_id,
        'member_month_hours_set',
        'capacity',
        NEW.id,
        v_label,
        jsonb_build_object(
          'user_id', NEW.user_id,
          'month_start', NEW.month_start,
          'old_hours', OLD.hours,
          'hours', NEW.hours
        )
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = OLD.user_id;
    v_label := coalesce(v_email, OLD.user_id::text) || ' · ' || to_char(OLD.month_start, 'YYYY-MM');
    PERFORM public.write_audit_log(
      OLD.workspace_id,
      'member_month_hours_cleared',
      'capacity',
      OLD.id,
      v_label,
      jsonb_build_object(
        'user_id', OLD.user_id,
        'month_start', OLD.month_start,
        'old_hours', OLD.hours
      )
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

ALTER FUNCTION public.audit_member_month_capacities_changes() OWNER TO postgres;

DROP TRIGGER IF EXISTS member_month_capacities_audit_log ON public.member_month_capacities;
CREATE TRIGGER member_month_capacities_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.member_month_capacities
  FOR EACH ROW EXECUTE FUNCTION public.audit_member_month_capacities_changes();

-- -----------------------------------------------------------------------------
-- Audit: also track weekly_capacity_hours on workspace_members
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_workspace_members_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_label TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT email INTO v_label FROM public.profiles WHERE id = NEW.user_id;
    PERFORM public.write_audit_log(
      NEW.workspace_id, 'member_added', 'member', NEW.user_id, v_label,
      jsonb_build_object('role', NEW.role, 'job_role', NEW.job_role)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role OR OLD.job_role IS DISTINCT FROM NEW.job_role THEN
      SELECT email INTO v_label FROM public.profiles WHERE id = NEW.user_id;
      PERFORM public.write_audit_log(
        NEW.workspace_id, 'member_role_changed', 'member', NEW.user_id, v_label,
        jsonb_build_object(
          'old_role', OLD.role,
          'new_role', NEW.role,
          'old_job_role', OLD.job_role,
          'new_job_role', NEW.job_role
        )
      );
    END IF;
    IF OLD.weekly_capacity_hours IS DISTINCT FROM NEW.weekly_capacity_hours THEN
      SELECT email INTO v_label FROM public.profiles WHERE id = NEW.user_id;
      PERFORM public.write_audit_log(
        NEW.workspace_id, 'member_weekly_capacity_changed', 'capacity', NEW.user_id, v_label,
        jsonb_build_object(
          'old_weekly_capacity_hours', OLD.weekly_capacity_hours,
          'new_weekly_capacity_hours', NEW.weekly_capacity_hours
        )
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT email INTO v_label FROM public.profiles WHERE id = OLD.user_id;
    PERFORM public.write_audit_log(
      OLD.workspace_id, 'member_removed', 'member', OLD.user_id, v_label,
      jsonb_build_object('role', OLD.role)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
