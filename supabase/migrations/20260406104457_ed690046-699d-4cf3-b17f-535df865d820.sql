
CREATE OR REPLACE FUNCTION public.enforce_loan_application_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS NULL OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status IN ('under_review', 'rejected', 'crb_failed', 'pmic_pending') THEN
    RETURN NEW;
  ELSIF OLD.status = 'under_review' AND NEW.status IN ('approved', 'rejected', 'crb_failed', 'pmic_pending', 'contract_signing') THEN
    RETURN NEW;
  ELSIF OLD.status = 'approved' AND NEW.status IN ('contract_signing', 'awaiting_disbursement', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'contract_signing' AND NEW.status IN ('awaiting_disbursement', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'awaiting_disbursement' AND NEW.status IN ('disbursed', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'disbursed' AND NEW.status IN ('active', 'completed', 'defaulted') THEN
    RETURN NEW;
  ELSIF OLD.status = 'active' AND NEW.status IN ('completed', 'defaulted') THEN
    RETURN NEW;
  ELSIF OLD.status = 'defaulted' AND NEW.status = 'completed' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid loan_applications status transition: % -> %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_loan_application_status_transition ON public.loan_applications;
CREATE TRIGGER trg_enforce_loan_application_status_transition
BEFORE UPDATE OF status ON public.loan_applications
FOR EACH ROW
EXECUTE FUNCTION public.enforce_loan_application_status_transition();

CREATE OR REPLACE FUNCTION public.enforce_disbursement_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS NULL OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status IN ('completed', 'failed', 'cancelled') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid disbursements status transition: % -> %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_disbursement_status_transition ON public.disbursements;
CREATE TRIGGER trg_enforce_disbursement_status_transition
BEFORE UPDATE OF status ON public.disbursements
FOR EACH ROW
EXECUTE FUNCTION public.enforce_disbursement_status_transition();

CREATE OR REPLACE FUNCTION public.enforce_payroll_run_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS NULL OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'draft' AND NEW.status IN ('approved', 'cancelled') THEN
    RETURN NEW;
  ELSIF OLD.status = 'approved' AND NEW.status IN ('paid', 'cancelled') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid payroll_runs status transition: % -> %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_payroll_run_status_transition ON public.payroll_runs;
CREATE TRIGGER trg_enforce_payroll_run_status_transition
BEFORE UPDATE OF status ON public.payroll_runs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_payroll_run_status_transition();
