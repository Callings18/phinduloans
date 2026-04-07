CREATE OR REPLACE FUNCTION public.enforce_loan_application_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NULL OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status IN ('under_review', 'approved', 'rejected', 'crb_failed', 'pmic_pending') THEN
    RETURN NEW;
  ELSIF OLD.status = 'under_review' AND NEW.status IN ('approved', 'rejected', 'crb_failed', 'pmic_pending', 'contract_signing') THEN
    RETURN NEW;
  ELSIF OLD.status = 'approved' AND NEW.status IN ('contract_signing', 'awaiting_disbursement', 'disbursed', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'contract_signing' AND NEW.status IN ('awaiting_disbursement', 'disbursed', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'awaiting_disbursement' AND NEW.status IN ('disbursed', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'disbursed' AND NEW.status IN ('active', 'completed', 'defaulted') THEN
    RETURN NEW;
  ELSIF OLD.status = 'active' AND NEW.status IN ('completed', 'defaulted') THEN
    RETURN NEW;
  ELSIF OLD.status = 'defaulted' AND NEW.status = 'completed' THEN
    RETURN NEW;
  ELSIF OLD.status = 'crb_failed' AND NEW.status IN ('under_review', 'approved', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'pmic_pending' AND NEW.status IN ('under_review', 'approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid loan_applications status transition: % -> %', OLD.status, NEW.status;
END;
$$;