
CREATE OR REPLACE FUNCTION public.guard_borrower_loan_application_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reverted public.loan_applications;
  v_allowed_sign_transition boolean := false;
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'super_admin'::app_role)
     OR has_role(auth.uid(), 'loan_officer'::app_role)
     OR has_role(auth.uid(), 'credit_officer'::app_role) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending'::loan_status THEN
    RETURN NEW;
  END IF;

  v_allowed_sign_transition := (
    OLD.status IN ('approved'::loan_status, 'contract_signing'::loan_status)
    AND NEW.status = 'awaiting_disbursement'::loan_status
    AND NEW.borrower_signed IS TRUE
  );

  reverted := NEW;
  reverted.borrower_signed := OLD.borrower_signed;
  reverted.borrower_signed_at := OLD.borrower_signed_at;
  reverted.signed_contract_url := OLD.signed_contract_url;
  reverted.updated_at := OLD.updated_at;
  IF v_allowed_sign_transition THEN
    reverted.status := OLD.status;
  END IF;

  IF reverted IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Borrowers may only update contract-signing fields on their applications';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_borrower_loan_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_staff boolean;
  v_allowed_sign_transition boolean := false;
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

  v_allowed_sign_transition := (
    OLD.status IN ('approved'::loan_status, 'contract_signing'::loan_status)
    AND NEW.status = 'awaiting_disbursement'::loan_status
    AND NEW.borrower_signed IS TRUE
  );

  IF NEW.loan_amount IS DISTINCT FROM OLD.loan_amount
     OR NEW.interest_rate IS DISTINCT FROM OLD.interest_rate
     OR NEW.monthly_payment IS DISTINCT FROM OLD.monthly_payment
     OR NEW.total_repayment IS DISTINCT FROM OLD.total_repayment
     OR NEW.loan_term_months IS DISTINCT FROM OLD.loan_term_months
     OR NEW.term_unit IS DISTINCT FROM OLD.term_unit
     OR NEW.loan_product_id IS DISTINCT FROM OLD.loan_product_id
     OR (NEW.status IS DISTINCT FROM OLD.status AND NOT v_allowed_sign_transition)
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
$$;
