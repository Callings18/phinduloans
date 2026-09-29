-- Borrower portal + admin visibility fixes (contract sign status, house roster, app docs RLS).

-- 1) Allow borrowers to move approved/contract_signing -> awaiting_disbursement after signing
CREATE OR REPLACE FUNCTION public.enforce_borrower_loan_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_staff boolean;
  v_allowed_status_transition boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_staff :=
       public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_role(v_uid, 'super_admin'::public.app_role)
    OR public.has_role(v_uid, 'loan_officer'::public.app_role)
    OR public.has_role(v_uid, 'credit_officer'::public.app_role)
    OR public.has_role(v_uid, 'finance_officer'::public.app_role)
    OR public.has_role(v_uid, 'collections_officer'::public.app_role);

  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  v_allowed_status_transition :=
    NEW.status IS DISTINCT FROM OLD.status
    AND OLD.status::text IN ('approved', 'contract_signing')
    AND NEW.status::text = 'awaiting_disbursement';

  IF v_allowed_status_transition THEN
    IF NEW.loan_amount IS NOT DISTINCT FROM OLD.loan_amount
       AND NEW.interest_rate IS NOT DISTINCT FROM OLD.interest_rate
       AND NEW.monthly_payment IS NOT DISTINCT FROM OLD.monthly_payment
       AND NEW.total_repayment IS NOT DISTINCT FROM OLD.total_repayment
       AND NEW.loan_term_months IS NOT DISTINCT FROM OLD.loan_term_months
       AND NEW.term_unit IS NOT DISTINCT FROM OLD.term_unit
       AND NEW.loan_product_id IS NOT DISTINCT FROM OLD.loan_product_id
       AND NEW.admin_notes IS NOT DISTINCT FROM OLD.admin_notes
       AND NEW.approved_by IS NOT DISTINCT FROM OLD.approved_by
       AND NEW.approved_at IS NOT DISTINCT FROM OLD.approved_at
       AND NEW.reviewed_by IS NOT DISTINCT FROM OLD.reviewed_by
       AND NEW.reviewed_at IS NOT DISTINCT FROM OLD.reviewed_at
       AND NEW.recommended_by IS NOT DISTINCT FROM OLD.recommended_by
       AND NEW.recommended_at IS NOT DISTINCT FROM OLD.recommended_at
       AND NEW.document_verified_by IS NOT DISTINCT FROM OLD.document_verified_by
       AND NEW.document_verified_at IS NOT DISTINCT FROM OLD.document_verified_at
       AND NEW.finance_verified_by IS NOT DISTINCT FROM OLD.finance_verified_by
       AND NEW.finance_verified_at IS NOT DISTINCT FROM OLD.finance_verified_at
       AND NEW.disbursed_by IS NOT DISTINCT FROM OLD.disbursed_by
       AND NEW.disbursed_at IS NOT DISTINCT FROM OLD.disbursed_at
       AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to
       AND NEW.approval_stage IS NOT DISTINCT FROM OLD.approval_stage
       AND NEW.admin_signed IS NOT DISTINCT FROM OLD.admin_signed
       AND NEW.admin_signed_by IS NOT DISTINCT FROM OLD.admin_signed_by
       AND NEW.admin_signed_at IS NOT DISTINCT FROM OLD.admin_signed_at
       AND NEW.total_penalties IS NOT DISTINCT FROM OLD.total_penalties
       AND NEW.penalty_count IS NOT DISTINCT FROM OLD.penalty_count
       AND NEW.legal_fees IS NOT DISTINCT FROM OLD.legal_fees
       AND NEW.enforcement_fees IS NOT DISTINCT FROM OLD.enforcement_fees
       AND NEW.early_settlement_fee IS NOT DISTINCT FROM OLD.early_settlement_fee
       AND NEW.settlement_date IS NOT DISTINCT FROM OLD.settlement_date
       AND NEW.settlement_type IS NOT DISTINCT FROM OLD.settlement_type
       AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
       AND NEW.parent_loan_id IS NOT DISTINCT FROM OLD.parent_loan_id
    THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.loan_amount IS DISTINCT FROM OLD.loan_amount
     OR NEW.interest_rate IS DISTINCT FROM OLD.interest_rate
     OR NEW.monthly_payment IS DISTINCT FROM OLD.monthly_payment
     OR NEW.total_repayment IS DISTINCT FROM OLD.total_repayment
     OR NEW.loan_term_months IS DISTINCT FROM OLD.loan_term_months
     OR NEW.term_unit IS DISTINCT FROM OLD.term_unit
     OR NEW.loan_product_id IS DISTINCT FROM OLD.loan_product_id
     OR (
       NEW.status IS DISTINCT FROM OLD.status
       AND NOT v_allowed_status_transition
     )
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.recommended_by IS DISTINCT FROM OLD.recommended_by
     OR NEW.recommended_at IS DISTINCT FROM OLD.recommended_at
     OR NEW.document_verified_by IS DISTINCT FROM OLD.document_verified_by
     OR NEW.document_verified_at IS DISTINCT FROM OLD.document_verified_at
     OR NEW.finance_verified_by IS DISTINCT FROM OLD.finance_verified_by
     OR NEW.finance_verified_at IS DISTINCT FROM OLD.finance_verified_at
     OR NEW.disbursed_by IS DISTINCT FROM OLD.disbursed_by
     OR NEW.disbursed_at IS DISTINCT FROM OLD.disbursed_at
     OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     OR NEW.approval_stage IS DISTINCT FROM OLD.approval_stage
     OR NEW.admin_signed IS DISTINCT FROM OLD.admin_signed
     OR NEW.admin_signed_by IS DISTINCT FROM OLD.admin_signed_by
     OR NEW.admin_signed_at IS DISTINCT FROM OLD.admin_signed_at
     OR NEW.total_penalties IS DISTINCT FROM OLD.total_penalties
     OR NEW.penalty_count IS DISTINCT FROM OLD.penalty_count
     OR NEW.legal_fees IS DISTINCT FROM OLD.legal_fees
     OR NEW.enforcement_fees IS DISTINCT FROM OLD.enforcement_fees
     OR NEW.early_settlement_fee IS DISTINCT FROM OLD.early_settlement_fee
     OR NEW.settlement_date IS DISTINCT FROM OLD.settlement_date
     OR NEW.settlement_type IS DISTINCT FROM OLD.settlement_type
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.parent_loan_id IS DISTINCT FROM OLD.parent_loan_id
  THEN
    RAISE EXCEPTION 'Borrowers may only update contract-signing fields on their loan application';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Self-service apply: borrower enrolls on product house roster
DROP POLICY IF EXISTS "product_house_borrowers_insert" ON public.product_house_borrowers;
CREATE POLICY "product_house_borrowers_insert"
ON public.product_house_borrowers
FOR INSERT
TO authenticated
WITH CHECK (
  (
    borrower_id = auth.uid()
    AND added_by = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_product_access(auth.uid(), product_code)
);

-- 3) Finance/collections can view/verify application documents
DROP POLICY IF EXISTS "Admins can view all documents" ON public.application_documents;
CREATE POLICY "Admins can view all documents"
  ON public.application_documents FOR SELECT
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'loan_officer'::app_role)
    OR public.has_role(auth.uid(), 'credit_officer'::app_role)
    OR public.has_role(auth.uid(), 'finance_officer'::app_role)
    OR public.has_role(auth.uid(), 'collections_officer'::app_role)
  );

DROP POLICY IF EXISTS "Admins can verify/reject documents" ON public.application_documents;
CREATE POLICY "Admins can verify/reject documents"
  ON public.application_documents FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'loan_officer'::app_role)
    OR public.has_role(auth.uid(), 'credit_officer'::app_role)
    OR public.has_role(auth.uid(), 'finance_officer'::app_role)
    OR public.has_role(auth.uid(), 'collections_officer'::app_role)
  );

-- 4) Borrower may resubmit payment proof after staff requests more info
DROP POLICY IF EXISTS "Borrowers can resubmit payment claims needing info" ON public.payment_claims;
CREATE POLICY "Borrowers can resubmit payment claims needing info"
  ON public.payment_claims
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'needs_more_info')
  WITH CHECK (auth.uid() = user_id AND status = 'pending_review');
