-- Workflow-stage permission rules are admin configuration, never public data.
ALTER TABLE public.workflow_stage_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage workflow stage permissions"
  ON public.workflow_stage_permissions;
CREATE POLICY "Admins manage workflow stage permissions"
  ON public.workflow_stage_permissions
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );
