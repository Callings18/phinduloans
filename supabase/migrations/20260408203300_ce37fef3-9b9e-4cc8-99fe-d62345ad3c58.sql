-- Fix: Allow direct transition to 'awaiting_disbursement' from statuses that the RPC's 'approve' action handles
CREATE OR REPLACE FUNCTION public.enforce_loan_application_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old text := OLD.status::text;
  v_new text := NEW.status::text;
BEGIN
  IF v_new IS NULL OR v_old = v_new THEN
    RETURN NEW;
  END IF;

  -- pending: direct approve allowed (CRB/PMIC disabled); awaiting_disbursement added for RPC approve action
  IF v_old = 'pending' AND v_new IN ('under_review', 'approved', 'awaiting_disbursement', 'rejected', 'crb_failed', 'pmic_pending') THEN
    RETURN NEW;
  ELSIF v_old = 'under_review' AND v_new IN ('approved', 'awaiting_disbursement', 'rejected', 'crb_failed', 'pmic_pending', 'contract_signing') THEN
    RETURN NEW;
  ELSIF v_old = 'approved' AND v_new IN ('contract_signing', 'awaiting_disbursement', 'disbursed', 'active', 'rejected') THEN
    RETURN NEW;
  ELSIF v_old = 'contract_signing' AND v_new IN ('awaiting_disbursement', 'disbursed', 'active', 'rejected') THEN
    RETURN NEW;
  ELSIF v_old = 'awaiting_disbursement' AND v_new IN ('disbursed', 'active', 'rejected') THEN
    RETURN NEW;
  ELSIF v_old = 'disbursed' AND v_new IN ('active', 'completed', 'defaulted') THEN
    RETURN NEW;
  ELSIF v_old = 'active' AND v_new IN ('completed', 'defaulted') THEN
    RETURN NEW;
  ELSIF v_old = 'defaulted' AND v_new = 'completed' THEN
    RETURN NEW;
  ELSIF v_old = 'crb_failed' AND v_new IN ('under_review', 'approved', 'awaiting_disbursement', 'rejected') THEN
    RETURN NEW;
  ELSIF v_old = 'pmic_pending' AND v_new IN ('under_review', 'approved', 'awaiting_disbursement', 'rejected') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid loan_applications status transition: % -> %', v_old, v_new;
END;
$function$;