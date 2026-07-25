-- Helm PM: Migration 010 — customers, meetings, requirements

-- -----------------------------------------------------------------------------
-- customers — ลูกค้าระดับ workspace
-- -----------------------------------------------------------------------------
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  contact_email TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX customers_workspace_id_idx ON customers(workspace_id);

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------------------------
-- meetings — บันทึกประชุมต่อลูกค้า
-- -----------------------------------------------------------------------------
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  met_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX meetings_customer_id_idx ON meetings(customer_id);

-- -----------------------------------------------------------------------------
-- requirements — ความต้องการจากลูกค้า / ประชุม
-- -----------------------------------------------------------------------------
CREATE TABLE requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX requirements_customer_id_idx ON requirements(customer_id);
CREATE INDEX requirements_meeting_id_idx ON requirements(meeting_id);

CREATE TRIGGER requirements_updated_at
  BEFORE UPDATE ON requirements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------------------------
-- Link projects / tasks to customers
-- -----------------------------------------------------------------------------
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projects_customer_id_idx ON projects(customer_id);

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_customer_id_idx ON tasks(customer_id);

-- -----------------------------------------------------------------------------
-- Helper: workspace จาก customer
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION customer_workspace_id(c_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT workspace_id FROM customers WHERE id = c_id;
$$;

ALTER FUNCTION public.customer_workspace_id(UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.customer_workspace_id(UUID) TO authenticated, anon, service_role;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view customers"
  ON customers FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Writers can create customers"
  ON customers FOR INSERT
  WITH CHECK (can_write_workspace(workspace_id));

CREATE POLICY "Writers can update customers"
  ON customers FOR UPDATE
  USING (can_write_workspace(workspace_id));

CREATE POLICY "Writers can delete customers"
  ON customers FOR DELETE
  USING (can_write_workspace(workspace_id));

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view meetings"
  ON meetings FOR SELECT
  USING (is_workspace_member(customer_workspace_id(customer_id)));

CREATE POLICY "Writers can create meetings"
  ON meetings FOR INSERT
  WITH CHECK (can_write_workspace(customer_workspace_id(customer_id)));

CREATE POLICY "Writers can update meetings"
  ON meetings FOR UPDATE
  USING (can_write_workspace(customer_workspace_id(customer_id)));

CREATE POLICY "Writers can delete meetings"
  ON meetings FOR DELETE
  USING (can_write_workspace(customer_workspace_id(customer_id)));

ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view requirements"
  ON requirements FOR SELECT
  USING (is_workspace_member(customer_workspace_id(customer_id)));

CREATE POLICY "Writers can create requirements"
  ON requirements FOR INSERT
  WITH CHECK (can_write_workspace(customer_workspace_id(customer_id)));

CREATE POLICY "Writers can update requirements"
  ON requirements FOR UPDATE
  USING (can_write_workspace(customer_workspace_id(customer_id)));

CREATE POLICY "Writers can delete requirements"
  ON requirements FOR DELETE
  USING (can_write_workspace(customer_workspace_id(customer_id)));

-- Grants + reload PostgREST
GRANT SELECT, INSERT, UPDATE, DELETE ON customers, meetings, requirements TO authenticated;
GRANT ALL ON customers, meetings, requirements TO service_role;
GRANT SELECT ON customers, meetings, requirements TO anon;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
