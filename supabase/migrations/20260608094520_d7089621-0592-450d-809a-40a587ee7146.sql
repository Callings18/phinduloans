DROP POLICY IF EXISTS "Staff can update own notes" ON public.loan_notes;

CREATE POLICY "Staff can update own notes"
ON public.loan_notes
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'loan_officer'::app_role)
    OR has_role(auth.uid(), 'credit_officer'::app_role)
    OR has_role(auth.uid(), 'finance_officer'::app_role)
    OR has_role(auth.uid(), 'collections_officer'::app_role)
    OR has_role(auth.uid(), 'support'::app_role)
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'loan_officer'::app_role)
    OR has_role(auth.uid(), 'credit_officer'::app_role)
    OR has_role(auth.uid(), 'finance_officer'::app_role)
    OR has_role(auth.uid(), 'collections_officer'::app_role)
    OR has_role(auth.uid(), 'support'::app_role)
  )
);