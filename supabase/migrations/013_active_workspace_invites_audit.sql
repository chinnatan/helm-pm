-- =============================================================================
-- Helm PM: Migration 013 — active workspace, signup workspace name,
--           workspace invites, audit log
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles.active_workspace_id
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_workspace_id UUID
    REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_active_workspace_id_idx
  ON public.profiles(active_workspace_id);

UPDATE public.profiles p
SET active_workspace_id = sub.workspace_id
FROM (
  SELECT DISTINCT ON (wm.user_id)
    wm.user_id,
    wm.workspace_id
  FROM public.workspace_members wm
  ORDER BY wm.user_id, wm.created_at ASC
) sub
WHERE p.id = sub.user_id
  AND p.active_workspace_id IS NULL;

-- -----------------------------------------------------------------------------
-- set_active_workspace / create_workspace
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_active_workspace(ws_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF ws_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  UPDATE public.profiles
  SET active_workspace_id = ws_id
  WHERE id = auth.uid();

  RETURN ws_id;
END;
$$;

ALTER FUNCTION public.set_active_workspace(UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.set_active_workspace(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_workspace(ws_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  ws_id UUID;
  trimmed TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  trimmed := NULLIF(trim(ws_name), '');
  IF trimmed IS NULL THEN
    RAISE EXCEPTION 'Workspace name is required';
  END IF;

  INSERT INTO public.workspaces (name)
  VALUES (trimmed)
  RETURNING id INTO ws_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (ws_id, auth.uid(), 'admin');

  INSERT INTO public.labels (workspace_id, name, color) VALUES
    (ws_id, 'Bug', '#dc2626'),
    (ws_id, 'Feature', '#2563eb'),
    (ws_id, 'Improvement', '#16a34a'),
    (ws_id, 'Documentation', '#7c3aed');

  UPDATE public.profiles
  SET active_workspace_id = ws_id
  WHERE id = auth.uid();

  RETURN ws_id;
END;
$$;

ALTER FUNCTION public.create_workspace(TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT) TO authenticated;

-- Signup: optional workspace_name from user_metadata → default My Workspace
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws_id UUID;
  ws_name TEXT;
BEGIN
  SELECT COALESCE(
    NULLIF(trim(u.raw_user_meta_data->>'workspace_name'), ''),
    'My Workspace'
  )
  INTO ws_name
  FROM auth.users u
  WHERE u.id = NEW.id;

  IF ws_name IS NULL THEN
    ws_name := 'My Workspace';
  END IF;

  INSERT INTO public.workspaces (name)
  VALUES (ws_name)
  RETURNING id INTO ws_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (ws_id, NEW.id, 'admin');

  INSERT INTO public.labels (workspace_id, name, color) VALUES
    (ws_id, 'Bug', '#dc2626'),
    (ws_id, 'Feature', '#2563eb'),
    (ws_id, 'Improvement', '#16a34a'),
    (ws_id, 'Documentation', '#7c3aed');

  UPDATE public.profiles
  SET active_workspace_id = ws_id
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_profile() OWNER TO postgres;

-- -----------------------------------------------------------------------------
-- audit_log
-- -----------------------------------------------------------------------------
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_label TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_workspace_created_idx
  ON public.audit_log (workspace_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON public.audit_log FOR SELECT
  USING (public.is_workspace_admin(workspace_id));

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_workspace_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_entity_label TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO public.audit_log (
    workspace_id, actor_id, action, entity_type, entity_id, entity_label, metadata
  )
  VALUES (
    p_workspace_id,
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    p_entity_label,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

ALTER FUNCTION public.write_audit_log(UUID, TEXT, TEXT, UUID, TEXT, JSONB) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.write_audit_log(UUID, TEXT, TEXT, UUID, TEXT, JSONB) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- workspace_invites
-- -----------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projects_owner_id_idx
  ON public.projects(owner_id);

UPDATE public.projects
SET owner_id = (
  SELECT wm.user_id
  FROM public.workspace_members wm
  WHERE wm.workspace_id = public.projects.workspace_id
  ORDER BY
    CASE wm.role
      WHEN 'admin' THEN 0
      WHEN 'manager' THEN 1
      ELSE 2
    END,
    wm.created_at ASC
  LIMIT 1
)
WHERE owner_id IS NULL;

DROP POLICY IF EXISTS "Writers can create projects" ON public.projects;
CREATE POLICY "Writers can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (
    public.can_write_workspace(workspace_id)
    AND (
      owner_id IS NULL
      OR owner_id = auth.uid()
      OR public.is_workspace_manager(workspace_id)
    )
  );

DROP POLICY IF EXISTS "Writers can update projects" ON public.projects;
CREATE POLICY "Writers can update projects"
  ON public.projects FOR UPDATE
  USING (
    public.can_write_workspace(workspace_id)
    OR owner_id = auth.uid()
  )
  WITH CHECK (
    public.can_write_workspace(workspace_id)
    OR owner_id = auth.uid()
  );

CREATE TABLE public.workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  invite_type TEXT NOT NULL CHECK (invite_type IN ('open', 'email')),
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin', 'manager', 'member', 'viewer')),
  job_role TEXT CHECK (job_role IS NULL OR job_role IN ('developer', 'tester', 'designer', 'pm', 'other')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT workspace_invites_email_required
    CHECK (invite_type = 'open' OR email IS NOT NULL)
);

CREATE INDEX workspace_invites_token_idx ON public.workspace_invites (token);
CREATE INDEX workspace_invites_workspace_idx ON public.workspace_invites (workspace_id);
CREATE INDEX workspace_invites_expires_idx ON public.workspace_invites (expires_at);

ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view workspace invites"
  ON public.workspace_invites FOR SELECT
  USING (public.is_workspace_admin(workspace_id));

CREATE POLICY "Admins can insert workspace invites"
  ON public.workspace_invites FOR INSERT
  WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "Admins can update workspace invites"
  ON public.workspace_invites FOR UPDATE
  USING (public.is_workspace_admin(workspace_id));

GRANT SELECT, INSERT, UPDATE ON public.workspace_invites TO authenticated;
GRANT ALL ON public.workspace_invites TO service_role;

-- -----------------------------------------------------------------------------
-- Invite RPCs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_workspace_invite(
  p_workspace_id UUID,
  p_invite_type TEXT,
  p_expires_at TIMESTAMPTZ,
  p_role TEXT DEFAULT 'member',
  p_job_role TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_token TEXT;
  v_email TEXT;
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_workspace_admin(p_workspace_id) THEN
    RAISE EXCEPTION 'Only workspace admins can create invites';
  END IF;

  IF p_invite_type NOT IN ('open', 'email') THEN
    RAISE EXCEPTION 'Invalid invite type';
  END IF;

  IF p_expires_at IS NULL OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'Expiry must be in the future';
  END IF;

  IF p_role NOT IN ('admin', 'manager', 'member', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  v_email := NULLIF(lower(trim(COALESCE(p_email, ''))), '');
  IF p_invite_type = 'email' AND v_email IS NULL THEN
    RAISE EXCEPTION 'Email is required for email invites';
  END IF;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  INSERT INTO public.workspace_invites (
    workspace_id, token, invite_type, email, role, job_role, expires_at, created_by
  )
  VALUES (
    p_workspace_id, v_token, p_invite_type, v_email, p_role, p_job_role, p_expires_at, auth.uid()
  )
  RETURNING id INTO v_id;

  PERFORM public.write_audit_log(
    p_workspace_id,
    'invite_created',
    'invite',
    v_id,
    COALESCE(v_email, 'open link'),
    jsonb_build_object(
      'invite_type', p_invite_type,
      'role', p_role,
      'expires_at', p_expires_at
    )
  );

  RETURN jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'expires_at', p_expires_at
  );
END;
$$;

ALTER FUNCTION public.create_workspace_invite(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.create_workspace_invite(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_invite_preview(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  inv RECORD;
  v_status TEXT;
BEGIN
  SELECT wi.*, w.name AS workspace_name
  INTO inv
  FROM public.workspace_invites wi
  JOIN public.workspaces w ON w.id = wi.workspace_id
  WHERE wi.token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF inv.revoked_at IS NOT NULL THEN
    v_status := 'revoked';
  ELSIF inv.accepted_at IS NOT NULL THEN
    v_status := 'accepted';
  ELSIF inv.expires_at <= now() THEN
    v_status := 'expired';
  ELSE
    v_status := 'valid';
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'workspace_id', inv.workspace_id,
    'workspace_name', inv.workspace_name,
    'invite_type', inv.invite_type,
    'email', inv.email,
    'role', inv.role,
    'expires_at', inv.expires_at
  );
END;
$$;

ALTER FUNCTION public.get_invite_preview(TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_invite_preview(TEXT) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  inv RECORD;
  v_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO inv
  FROM public.workspace_invites
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite has been revoked';
  END IF;

  IF inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite has already been used';
  END IF;

  IF inv.expires_at <= now() THEN
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  IF inv.invite_type = 'email' THEN
    SELECT lower(email) INTO v_email
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_email IS DISTINCT FROM lower(inv.email) THEN
      RAISE EXCEPTION 'This invite is for a different email address';
    END IF;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, job_role)
  VALUES (inv.workspace_id, auth.uid(), inv.role, inv.job_role)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  UPDATE public.workspace_invites
  SET accepted_at = now(), accepted_by = auth.uid()
  WHERE id = inv.id;

  UPDATE public.profiles
  SET active_workspace_id = inv.workspace_id
  WHERE id = auth.uid();

  PERFORM public.write_audit_log(
    inv.workspace_id,
    'invite_accepted',
    'invite',
    inv.id,
    COALESCE(inv.email, 'open link'),
    jsonb_build_object('role', inv.role, 'accepted_by', auth.uid())
  );

  RETURN inv.workspace_id;
END;
$$;

ALTER FUNCTION public.accept_workspace_invite(TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_workspace_invite(p_invite_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  inv RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO inv
  FROM public.workspace_invites
  WHERE id = p_invite_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF NOT public.is_workspace_admin(inv.workspace_id) THEN
    RAISE EXCEPTION 'Only workspace admins can revoke invites';
  END IF;

  IF inv.revoked_at IS NOT NULL THEN
    RETURN;
  END IF;

  IF inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot revoke an accepted invite';
  END IF;

  UPDATE public.workspace_invites
  SET revoked_at = now()
  WHERE id = p_invite_id;

  PERFORM public.write_audit_log(
    inv.workspace_id,
    'invite_revoked',
    'invite',
    inv.id,
    COALESCE(inv.email, 'open link'),
    '{}'::jsonb
  );
END;
$$;

ALTER FUNCTION public.revoke_workspace_invite(UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.revoke_workspace_invite(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- Audit triggers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_projects_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_audit_log(
      NEW.workspace_id, 'created', 'project', NEW.id, NEW.name,
      jsonb_build_object('color', NEW.color, 'owner_id', NEW.owner_id)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.name IS DISTINCT FROM NEW.name
       OR OLD.archived_at IS DISTINCT FROM NEW.archived_at
       OR OLD.description IS DISTINCT FROM NEW.description
       OR OLD.customer_id IS DISTINCT FROM NEW.customer_id
       OR OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
      PERFORM public.write_audit_log(
        NEW.workspace_id, 'updated', 'project', NEW.id, NEW.name,
        jsonb_build_object(
          'old_name', OLD.name,
          'new_name', NEW.name,
          'old_archived_at', OLD.archived_at,
          'new_archived_at', NEW.archived_at,
          'old_owner_id', OLD.owner_id,
          'new_owner_id', NEW.owner_id
        )
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.write_audit_log(
      OLD.workspace_id, 'deleted', 'project', OLD.id, OLD.name, '{}'::jsonb
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

ALTER FUNCTION public.audit_projects_changes() OWNER TO postgres;

DROP TRIGGER IF EXISTS projects_audit_log ON public.projects;
CREATE TRIGGER projects_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.audit_projects_changes();

CREATE OR REPLACE FUNCTION public.audit_customers_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_audit_log(
      NEW.workspace_id, 'created', 'customer', NEW.id, NEW.name,
      jsonb_build_object('status', NEW.status)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.name IS DISTINCT FROM NEW.name
       OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.company IS DISTINCT FROM NEW.company THEN
      PERFORM public.write_audit_log(
        NEW.workspace_id, 'updated', 'customer', NEW.id, NEW.name,
        jsonb_build_object(
          'old_name', OLD.name,
          'new_name', NEW.name,
          'old_status', OLD.status,
          'new_status', NEW.status
        )
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.write_audit_log(
      OLD.workspace_id, 'deleted', 'customer', OLD.id, OLD.name, '{}'::jsonb
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

ALTER FUNCTION public.audit_customers_changes() OWNER TO postgres;

DROP TRIGGER IF EXISTS customers_audit_log ON public.customers;
CREATE TRIGGER customers_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.audit_customers_changes();

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

ALTER FUNCTION public.audit_workspace_members_changes() OWNER TO postgres;

DROP TRIGGER IF EXISTS workspace_members_audit_log ON public.workspace_members;
CREATE TRIGGER workspace_members_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_workspace_members_changes();
