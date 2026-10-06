-- Phase 1.4: Delete policy for loan_applications
-- Only allow delete when: (status is pending/rejected/under_review AND user has loans.delete)
-- OR user is super_admin (with audit in app layer).

DROP POLICY IF EXISTS "Admins can delete applications" ON public.loan_applications;

DROP POLICY IF EXISTS "Staff can delete applications in early stages" ON public.loan_applications;
CREATE POLICY "Staff can delete applications in early stages"
  ON public.loan_applications FOR DELETE
  USING (
    (
      status IN ('pending', 'rejected', 'under_review')
      AND public.has_permission(auth.uid(), 'loans', 'delete')
    )
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

COMMENT ON POLICY "Staff can delete applications in early stages" ON public.loan_applications IS
  'Delete allowed only for pending/rejected/under_review when user has loans.delete, or for super_admin on any row.';
