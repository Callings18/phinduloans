-- Allow borrowers to submit files against staff-requested document checklist items.
-- Staff-only columns are protected by trigger.

DROP POLICY IF EXISTS "Borrowers can submit checklist documents" ON public.document_checklists;

CREATE POLICY "Borrowers can submit checklist documents"
ON public.document_checklists
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.loan_applications la
    WHERE la.id = document_checklists.loan_id
      AND la.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.loan_applications la
    WHERE la.id = document_checklists.loan_id
      AND la.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.guard_borrower_checklist_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'loan_officer')
    OR public.has_role(auth.uid(), 'credit_officer')
  THEN
    RETURN NEW;
  END IF;

  NEW.loan_id := OLD.loan_id;
  NEW.document_type := OLD.document_type;
  NEW.document_name := OLD.document_name;
  NEW.is_required := OLD.is_required;
  NEW.is_verified := OLD.is_verified;
  NEW.verified_by := OLD.verified_by;
  NEW.verified_at := OLD.verified_at;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.notes := OLD.notes;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_borrower_checklist_update ON public.document_checklists;
CREATE TRIGGER trg_guard_borrower_checklist_update
BEFORE UPDATE ON public.document_checklists
FOR EACH ROW
EXECUTE FUNCTION public.guard_borrower_checklist_update();

COMMENT ON FUNCTION public.guard_borrower_checklist_update() IS
  'Borrowers may only update submission fields on their own checklist rows; staff retain full control.';
