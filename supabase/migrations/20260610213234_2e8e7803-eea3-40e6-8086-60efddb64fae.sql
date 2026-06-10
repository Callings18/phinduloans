-- 1) Restrict has_product_access to staff roles only (remove the borrower leakage path)
CREATE OR REPLACE FUNCTION public.has_product_access(p_user uuid, p_product_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(p_user, 'super_admin'::public.app_role)
    OR public.has_role(p_user, 'admin'::public.app_role)
    OR (
      (
        public.has_role(p_user, 'loan_officer'::public.app_role)
        OR public.has_role(p_user, 'credit_officer'::public.app_role)
        OR public.has_role(p_user, 'finance_officer'::public.app_role)
        OR public.has_role(p_user, 'collections_officer'::public.app_role)
      )
      AND EXISTS (
        SELECT 1 FROM public.user_product_access upa
        WHERE upa.user_id = p_user
          AND upa.product_code = p_product_code
          AND upa.is_active = true
      )
    );
$function$;

-- 2) Trigger: block non-staff (borrower) updates to staff-controlled columns
CREATE OR REPLACE FUNCTION public.enforce_borrower_loan_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_staff boolean;
BEGIN
  -- No authenticated user (service role / triggers) -> allow
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

  -- Staff can update freely
  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  -- Non-staff: only the owner can reach this via RLS; allow ONLY signing fields to change.
  IF NEW.loan_amount IS DISTINCT FROM OLD.loan_amount
     OR NEW.interest_rate IS DISTINCT FROM OLD.interest_rate
     OR NEW.monthly_payment IS DISTINCT FROM OLD.monthly_payment
     OR NEW.total_repayment IS DISTINCT FROM OLD.total_repayment
     OR NEW.loan_term_months IS DISTINCT FROM OLD.loan_term_months
     OR NEW.term_unit IS DISTINCT FROM OLD.term_unit
     OR NEW.loan_product_id IS DISTINCT FROM OLD.loan_product_id
     OR NEW.status IS DISTINCT FROM OLD.status
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

DROP TRIGGER IF EXISTS trg_enforce_borrower_loan_update_scope ON public.loan_applications;
CREATE TRIGGER trg_enforce_borrower_loan_update_scope
  BEFORE UPDATE ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_borrower_loan_update_scope();