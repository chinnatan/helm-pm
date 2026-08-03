-- Helm PM: tighten customer DELETE and project UPDATE permissions
-- - customers: hard delete only workspace admin
-- - projects: update (incl. soft archive) only owner or workspace admin

DROP POLICY IF EXISTS "Writers can delete customers" ON public.customers;
CREATE POLICY "Admins can delete customers"
  ON public.customers FOR DELETE
  USING (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "Writers can update projects" ON public.projects;
CREATE POLICY "Owners or admins can update projects"
  ON public.projects FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_admin(workspace_id)
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR public.is_workspace_admin(workspace_id)
  );
