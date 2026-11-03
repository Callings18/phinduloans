-- Loan activation must follow a recorded, fully signed contract and a
-- completed disbursement. This keeps direct table updates from bypassing the
-- checks in the borrower and staff interfaces.

CREATE OR REPLACE FUNCTION public.enforce_signed_contract_for_disbursed_loan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Legacy reloan issuance creates the replacement loan directly as active;
  -- that issuance path needs its own atomic workflow before it can use these
  -- standard disbursement guards.
  IF TG_OP = 'INSERT' AND NEW.source = 'reloan' AND NEW.status::text = 'active' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status::text IN ('disbursed', 'active') THEN
      IF (OLD.borrower_signed IS TRUE AND NEW.borrower_signed IS NOT TRUE)
         OR (OLD.admin_signed IS TRUE AND NEW.admin_signed IS NOT TRUE) THEN
        RAISE EXCEPTION 'Contract signatures cannot be removed after a loan has been disbursed.'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.status::text NOT IN ('disbursed', 'active') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND ((OLD.borrower_signed IS NOT TRUE AND NEW.borrower_signed IS TRUE)
       OR (OLD.admin_signed IS NOT TRUE AND NEW.admin_signed IS TRUE)) THEN
    RAISE EXCEPTION 'Record both contract signatures before disbursing or activating the loan.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status::text = 'disbursed'
     AND OLD.status::text NOT IN ('approved', 'contract_signing', 'awaiting_disbursement') THEN
    RAISE EXCEPTION 'A loan can only move to disbursed from an approved contract stage.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status::text = 'active'
     AND OLD.status::text NOT IN ('disbursed', 'completed') THEN
    RAISE EXCEPTION 'A loan can only become active after disbursement or a payment reversal.'
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE(NEW.borrower_signed, false) IS NOT TRUE
     OR COALESCE(NEW.admin_signed, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'A loan cannot be disbursed or activated until both parties have signed the contract.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.disbursements d
    WHERE d.loan_id = NEW.id
      AND d.status = 'completed'
  ) THEN
    RAISE EXCEPTION 'A loan cannot be disbursed or activated without a completed disbursement.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_signed_contract_for_disbursed_loan
  ON public.loan_applications;

CREATE TRIGGER enforce_signed_contract_for_disbursed_loan
  BEFORE INSERT OR UPDATE ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_signed_contract_for_disbursed_loan();

-- Approval records the lending decision; it does not mean either party has
-- signed the contract. Preserve signatures already recorded before approval,
-- but discard signature flags first added in the same approval write.
CREATE OR REPLACE FUNCTION public.prevent_auto_sign_on_loan_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text = 'approved' THEN
    IF TG_OP = 'INSERT' THEN
      IF COALESCE(NEW.borrower_signed, false) THEN
        NEW.borrower_signed := false;
        NEW.borrower_signed_at := NULL;
      END IF;
      IF COALESCE(NEW.admin_signed, false) THEN
        NEW.admin_signed := false;
        NEW.admin_signed_at := NULL;
        NEW.admin_signed_by := NULL;
      END IF;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      IF COALESCE(OLD.borrower_signed, false) IS FALSE
         AND COALESCE(NEW.borrower_signed, false) IS TRUE THEN
        NEW.borrower_signed := false;
        NEW.borrower_signed_at := NULL;
      END IF;

      IF COALESCE(OLD.admin_signed, false) IS FALSE
         AND COALESCE(NEW.admin_signed, false) IS TRUE THEN
        NEW.admin_signed := false;
        NEW.admin_signed_at := NULL;
        NEW.admin_signed_by := NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_auto_sign_on_loan_approval
  ON public.loan_applications;

CREATE TRIGGER prevent_auto_sign_on_loan_approval
  BEFORE INSERT OR UPDATE ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_auto_sign_on_loan_approval();
