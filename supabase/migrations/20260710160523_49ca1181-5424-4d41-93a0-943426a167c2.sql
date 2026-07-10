CREATE OR REPLACE FUNCTION public.prevent_borrower_sensitive_loan_application_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_staff boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_staff := public.has_role(v_user_id, 'super_admin')
    OR public.has_role(v_user_id, 'admin')
    OR public.has_role(v_user_id, 'loan_officer')
    OR public.has_role(v_user_id, 'credit_officer')
    OR public.has_role(v_user_id, 'finance_officer')
    OR public.has_role(v_user_id, 'collections_officer');

  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Borrowers can only update their own loan applications';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.loan_amount IS DISTINCT FROM OLD.loan_amount
    OR NEW.loan_term_months IS DISTINCT FROM OLD.loan_term_months
    OR NEW.interest_rate IS DISTINCT FROM OLD.interest_rate
    OR NEW.monthly_payment IS DISTINCT FROM OLD.monthly_payment
    OR NEW.total_repayment IS DISTINCT FROM OLD.total_repayment
    OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
    OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
    OR NEW.recommended_by IS DISTINCT FROM OLD.recommended_by
    OR NEW.recommended_at IS DISTINCT FROM OLD.recommended_at
    OR NEW.approval_stage IS DISTINCT FROM OLD.approval_stage
    OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
    OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
    OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
    OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
    OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
    OR NEW.disbursed_by IS DISTINCT FROM OLD.disbursed_by
    OR NEW.disbursed_at IS DISTINCT FROM OLD.disbursed_at
    OR NEW.finance_verified_by IS DISTINCT FROM OLD.finance_verified_by
    OR NEW.finance_verified_at IS DISTINCT FROM OLD.finance_verified_at
    OR NEW.admin_signed IS DISTINCT FROM OLD.admin_signed
    OR NEW.admin_signed_by IS DISTINCT FROM OLD.admin_signed_by
    OR NEW.admin_signed_at IS DISTINCT FROM OLD.admin_signed_at
    OR NEW.contract_fully_signed_at IS DISTINCT FROM OLD.contract_fully_signed_at
    OR NEW.document_verified_by IS DISTINCT FROM OLD.document_verified_by
    OR NEW.document_verified_at IS DISTINCT FROM OLD.document_verified_at
    OR NEW.repayment_start_date IS DISTINCT FROM OLD.repayment_start_date
    OR NEW.defaulted_at IS DISTINCT FROM OLD.defaulted_at
    OR NEW.legal_referred_at IS DISTINCT FROM OLD.legal_referred_at
    OR NEW.penalty_count IS DISTINCT FROM OLD.penalty_count
    OR NEW.total_penalties IS DISTINCT FROM OLD.total_penalties
    OR NEW.early_settlement_fee IS DISTINCT FROM OLD.early_settlement_fee
    OR NEW.enforcement_fees IS DISTINCT FROM OLD.enforcement_fees
    OR NEW.legal_fees IS DISTINCT FROM OLD.legal_fees
    OR NEW.settlement_date IS DISTINCT FROM OLD.settlement_date
    OR NEW.settlement_type IS DISTINCT FROM OLD.settlement_type
  THEN
    RAISE EXCEPTION 'Borrowers cannot update staff-only loan application fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_borrower_sensitive_loan_application_updates ON public.loan_applications;
CREATE TRIGGER trg_prevent_borrower_sensitive_loan_application_updates
BEFORE UPDATE ON public.loan_applications
FOR EACH ROW
EXECUTE FUNCTION public.prevent_borrower_sensitive_loan_application_updates();

CREATE OR REPLACE FUNCTION public.enforce_borrower_payment_claim_insert_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_staff boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_staff := public.has_role(v_user_id, 'super_admin')
    OR public.has_role(v_user_id, 'admin')
    OR public.has_role(v_user_id, 'loan_officer')
    OR public.has_role(v_user_id, 'finance_officer')
    OR public.has_role(v_user_id, 'collections_officer');

  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Borrowers can only submit their own payment claims';
  END IF;

  NEW.status := 'pending';
  NEW.verified_by := NULL;
  NEW.verified_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_borrower_payment_claim_insert_defaults ON public.payment_claims;
CREATE TRIGGER trg_enforce_borrower_payment_claim_insert_defaults
BEFORE INSERT ON public.payment_claims
FOR EACH ROW
EXECUTE FUNCTION public.enforce_borrower_payment_claim_insert_defaults();