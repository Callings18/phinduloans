-- Paste into Supabase SQL Editor (run as one script).
-- Step 1: allow active/disbursed → approved (undo disbursement status revert)
-- Step 2: install admin_undo_loan_disbursement RPC

CREATE OR REPLACE FUNCTION public.enforce_loan_application_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $function$
DECLARE
  v_old text := OLD.status::text;
  v_new text := NEW.status::text;
BEGIN
  IF v_new IS NULL OR v_old = v_new THEN
    RETURN NEW;
  END IF;

  IF v_old = 'pending' AND v_new IN ('under_review', 'approved', 'awaiting_disbursement', 'rejected', 'crb_failed', 'pmic_pending') THEN
    RETURN NEW;
  ELSIF v_old = 'under_review' AND v_new IN ('pending', 'approved', 'awaiting_disbursement', 'rejected', 'crb_failed', 'pmic_pending', 'contract_signing') THEN
    RETURN NEW;
  ELSIF v_old = 'approved' AND v_new IN ('pending', 'under_review', 'contract_signing', 'awaiting_disbursement', 'disbursed', 'active', 'rejected') THEN
    RETURN NEW;
  ELSIF v_old = 'contract_signing' AND v_new IN ('pending', 'under_review', 'approved', 'awaiting_disbursement', 'disbursed', 'active', 'rejected') THEN
    RETURN NEW;
  ELSIF v_old = 'awaiting_disbursement' AND v_new IN ('pending', 'under_review', 'approved', 'contract_signing', 'disbursed', 'active', 'rejected') THEN
    RETURN NEW;
  ELSIF v_old = 'disbursed' AND v_new IN ('approved', 'active', 'completed', 'defaulted') THEN
    RETURN NEW;
  ELSIF v_old = 'active' AND v_new IN ('approved', 'completed', 'defaulted') THEN
    RETURN NEW;
  ELSIF v_old = 'defaulted' AND v_new IN ('active', 'completed') THEN
    RETURN NEW;
  ELSIF v_old = 'rejected' AND v_new IN ('pending', 'under_review') THEN
    RETURN NEW;
  ELSIF v_old = 'crb_failed' AND v_new IN ('pending', 'under_review', 'approved', 'awaiting_disbursement', 'rejected') THEN
    RETURN NEW;
  ELSIF v_old = 'pmic_pending' AND v_new IN ('pending', 'under_review', 'approved', 'awaiting_disbursement', 'rejected') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid loan_applications status transition: % -> %', v_old, v_new;
END;
$function$;

-- (Copy body from migration 20261101140000_admin_undo_loan_disbursement_rpc.sql if this file is truncated in editor)
