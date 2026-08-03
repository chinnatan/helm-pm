-- Helm PM: multi-use invite links with configurable max_uses

ALTER TABLE public.workspace_invites
  ADD COLUMN IF NOT EXISTS max_uses INTEGER NOT NULL DEFAULT 1
    CHECK (max_uses >= 1),
  ADD COLUMN IF NOT EXISTS uses_count INTEGER NOT NULL DEFAULT 0
    CHECK (uses_count >= 0);

-- Existing accepted invites: treat as fully used once
UPDATE public.workspace_invites
SET
  max_uses = 1,
  uses_count = 1
WHERE accepted_at IS NOT NULL
  AND uses_count = 0;

COMMENT ON COLUMN public.workspace_invites.max_uses IS
  'How many people can redeem this invite link (email invites forced to 1)';
COMMENT ON COLUMN public.workspace_invites.uses_count IS
  'Successful new-member redemptions so far';

-- Recreate create with p_max_uses (must drop old signature)
DROP FUNCTION IF EXISTS public.create_workspace_invite(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_workspace_invite(
  p_workspace_id UUID,
  p_invite_type TEXT,
  p_expires_at TIMESTAMPTZ,
  p_role TEXT DEFAULT 'member',
  p_job_role TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_max_uses INTEGER DEFAULT 1
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
  v_max_uses INTEGER;
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

  -- Email-bound invites are single-recipient; open links can be multi-use
  IF p_invite_type = 'email' THEN
    v_max_uses := 1;
  ELSE
    v_max_uses := COALESCE(p_max_uses, 1);
    IF v_max_uses < 1 THEN
      RAISE EXCEPTION 'max_uses must be at least 1';
    END IF;
    IF v_max_uses > 500 THEN
      RAISE EXCEPTION 'max_uses cannot exceed 500';
    END IF;
  END IF;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  INSERT INTO public.workspace_invites (
    workspace_id, token, invite_type, email, role, job_role,
    expires_at, created_by, max_uses, uses_count
  )
  VALUES (
    p_workspace_id, v_token, p_invite_type, v_email, p_role, p_job_role,
    p_expires_at, auth.uid(), v_max_uses, 0
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
      'expires_at', p_expires_at,
      'max_uses', v_max_uses
    )
  );

  RETURN jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'expires_at', p_expires_at,
    'max_uses', v_max_uses
  );
END;
$$;

ALTER FUNCTION public.create_workspace_invite(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, INTEGER)
  OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.create_workspace_invite(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, INTEGER)
  TO authenticated;

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
  ELSIF inv.uses_count >= inv.max_uses THEN
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
    'expires_at', inv.expires_at,
    'max_uses', inv.max_uses,
    'uses_count', inv.uses_count
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
  v_already_member BOOLEAN;
  v_new_count INTEGER;
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

  IF inv.uses_count >= inv.max_uses THEN
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

  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = inv.workspace_id
      AND user_id = auth.uid()
  ) INTO v_already_member;

  IF NOT v_already_member THEN
    INSERT INTO public.workspace_members (workspace_id, user_id, role, job_role)
    VALUES (inv.workspace_id, auth.uid(), inv.role, inv.job_role);

    v_new_count := inv.uses_count + 1;

    UPDATE public.workspace_invites
    SET
      uses_count = v_new_count,
      accepted_by = auth.uid(),
      accepted_at = CASE
        WHEN v_new_count >= inv.max_uses THEN now()
        ELSE accepted_at
      END
    WHERE id = inv.id;

    PERFORM public.write_audit_log(
      inv.workspace_id,
      'invite_accepted',
      'invite',
      inv.id,
      COALESCE(inv.email, 'open link'),
      jsonb_build_object(
        'role', inv.role,
        'accepted_by', auth.uid(),
        'uses_count', v_new_count,
        'max_uses', inv.max_uses
      )
    );
  END IF;

  UPDATE public.profiles
  SET active_workspace_id = inv.workspace_id
  WHERE id = auth.uid();

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

  -- Exhausted links cannot be revoked (already fully used)
  IF inv.uses_count >= inv.max_uses THEN
    RAISE EXCEPTION 'Cannot revoke a fully used invite';
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
    jsonb_build_object('uses_count', inv.uses_count, 'max_uses', inv.max_uses)
  );
END;
$$;

ALTER FUNCTION public.revoke_workspace_invite(UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.revoke_workspace_invite(UUID) TO authenticated;
