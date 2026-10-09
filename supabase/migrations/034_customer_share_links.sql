-- Helm PM: Migration 034 — ลิงก์แชร์แบบอ่านอย่างเดียวให้ลูกค้า (ก้อน C)
-- anon ไม่มีสิทธิ์อ่านตารางใด ๆ ตรง ๆ — เข้าถึงได้ผ่าน RPC get_customer_share(token) เท่านั้น
-- และ RPC คืนเฉพาะข้อมูลที่ลูกค้าควรเห็น (Rollout/Commitment และคำขอที่ customer_visible = true)

CREATE TABLE customer_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  -- สุ่มฝั่ง DB เสมอ (client กำหนดเองไม่ได้): uuid v4 สองตัว = 244 บิตสุ่ม
  token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX customer_share_links_customer_id_idx ON customer_share_links(customer_id);

ALTER TABLE customer_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage share links" ON customer_share_links FOR ALL
  USING (is_workspace_manager(workspace_id))
  WITH CHECK (is_workspace_manager(workspace_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON customer_share_links TO authenticated;
-- Supabase ให้ anon ทุกสิทธิ์บนตารางใหม่โดยปริยาย — ถอนออก (RLS กันไว้อยู่แล้ว แต่ไม่ควรพึ่งชั้นเดียว)
REVOKE ALL ON customer_share_links FROM anon;
GRANT ALL ON customer_share_links TO service_role;

CREATE OR REPLACE FUNCTION public.get_customer_share(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  l customer_share_links;
  c customers;
BEGIN
  SELECT * INTO l FROM customer_share_links WHERE token = p_token;
  IF NOT FOUND OR l.revoked_at IS NOT NULL OR l.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT * INTO c FROM customers WHERE id = l.customer_id;

  RETURN jsonb_build_object(
    'status', 'valid',
    'expires_at', l.expires_at,
    'customer', jsonb_build_object('name', c.name, 'company', c.company),
    'rollouts', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'feature', f.name,
          'status', r.status,
          'commitments', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('month', m.month, 'target_status', m.target_status) ORDER BY m.month)
            FROM commitments m WHERE m.rollout_id = r.id
          ), '[]'::jsonb)
        ) ORDER BY f.sort_order, f.name
      )
      FROM rollouts r JOIN features f ON f.id = r.feature_id
      WHERE r.customer_id = c.id AND r.status <> 'cancelled'
    ), '[]'::jsonb),
    'requests', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'title', t.title,
          'feature', f.name,
          'response_status', t.response_status,
          'response_text', t.response_text,
          'requested_on', t.requested_on
        ) ORDER BY t.requested_on, t.created_at
      )
      FROM tasks t LEFT JOIN features f ON f.id = t.feature_id
      WHERE t.customer_id = c.id AND t.task_type = 'customer-request' AND t.customer_visible
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_share(text) TO anon, authenticated;
