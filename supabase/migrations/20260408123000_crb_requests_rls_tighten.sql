-- Tighten crb_requests policies to RBAC permissions (least privilege)

DROP POLICY IF EXISTS "Staff can view CRB requests" ON public.crb_requests;
CREATE POLICY "Staff can view CRB requests" ON public.crb_requests
  FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), 'loans', 'view')
    OR public.has_permission(auth.uid(), 'loans', 'finance_approve')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Staff can insert CRB requests" ON public.crb_requests;
CREATE POLICY "Staff can insert CRB requests" ON public.crb_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), 'loans', 'view')
    OR public.has_permission(auth.uid(), 'loans', 'finance_approve')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Staff can update CRB requests" ON public.crb_requests;
CREATE POLICY "Staff can update CRB requests" ON public.crb_requests
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), 'loans', 'finance_approve')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );
