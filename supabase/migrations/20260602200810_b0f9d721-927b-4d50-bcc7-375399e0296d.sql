-- Privilege escalation fix for loan_applications:
-- The "Borrowers can sign their own contracts" UPDATE policy only checked
-- auth.uid() = user_id, letting a borrower change ANY column (status,
-- interest_rate, approval_stage, admin_signed, approved_by, etc.) on any of
-- their own loans, including approved/disbursed/defaulted ones.
--
-- We add a BEFORE UPDATE trigger that:
--   * leaves staff/admin updates unrestricted
--   * leaves service_role / non-owner paths to RLS (auth.uid() is null for service role)
--   * allows owners to fully edit a PENDING draft (governed by the existing
--     "Users can update their pending applications" policy)
--   * for owners on any non-pending loan, permits ONLY the contract-signing
--     columns to change (borrower_signed, borrower_signed_at,
--     signed_contract_url, updated_at); any other change is rejected.

CREATE OR REPLACE FUNCTION public.guard_borrower_loan_application_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reverted public.loan_applications;
BEGIN
  -- Staff / admin updates are unrestricted.
  IF has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'super_admin'::app_role)
     OR has_role(auth.uid(), 'loan_officer'::app_role)
     OR has_role(auth.uid(), 'credit_officer'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Service role (edge functions) and any non-owner path: auth.uid() will not
  -- match the row owner; leave enforcement to RLS / other policies.
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;

  -- Owner editing their own draft application: allowed (pending policy governs).
  IF OLD.status = 'pending'::loan_status THEN
    RETURN NEW;
  END IF;

  -- Owner on a non-pending loan: only contract-signing columns may change.
  reverted := NEW;
  reverted.borrower_signed := OLD.borrower_signed;
  reverted.borrower_signed_at := OLD.borrower_signed_at;
  reverted.signed_contract_url := OLD.signed_contract_url;
  reverted.updated_at := OLD.updated_at;

  IF reverted IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Borrowers may only update contract-signing fields on their applications';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_borrower_loan_application_update ON public.loan_applications;

CREATE TRIGGER guard_borrower_loan_application_update
BEFORE UPDATE ON public.loan_applications
FOR EACH ROW
EXECUTE FUNCTION public.guard_borrower_loan_application_update();