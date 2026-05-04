-- Collateral joint-borrower extension.
-- Defense-in-depth on top of the existing loan_borrowers table created in
-- 20260429124526_4389e3a0-0ccc-4200-9911-bd9846e3d326.sql, which already:
--   * creates the public.loan_borrower_role enum
--   * creates public.loan_borrowers (loan_application_id, customer_id,
--     full_name, nrc_number, phone, address, role, is_signatory, ...)
--   * adds enforce_collateral_only_borrowers + RLS policies
--
-- This migration intentionally does NOT recreate the table, enum, or RLS
-- policies — it only adds the COLLATERAL-specific safety trigger that
-- prevents leaving a collateral loan without a primary borrower or signatory.
--
-- IMPORTANT: the earlier migration uses `loan_application_id`. The previous
-- version of this file mistakenly referenced `loan_id`, which would crash
-- on every insert/update/delete once applied.

CREATE OR REPLACE FUNCTION public.validate_collateral_loan_borrowers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_loan_id uuid;
  v_product_code text;
  v_primary_count integer;
  v_signatory_count integer;
BEGIN
  v_loan_id := COALESCE(NEW.loan_application_id, OLD.loan_application_id);
  IF v_loan_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT lp.product_code
  INTO v_product_code
  FROM public.loan_applications la
  JOIN public.loan_products lp ON lp.id = la.loan_product_id
  WHERE la.id = v_loan_id
  LIMIT 1;

  -- Only enforce on COLLATERAL loans. Non-collateral roster changes are
  -- already constrained by enforce_collateral_only_borrowers.
  IF v_product_code IS DISTINCT FROM 'COLLATERAL' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE lb.role = 'PRIMARY_BORROWER')::int,
    COUNT(*) FILTER (WHERE lb.is_signatory = true)::int
  INTO v_primary_count, v_signatory_count
  FROM public.loan_borrowers lb
  WHERE lb.loan_application_id = v_loan_id;

  IF v_primary_count < 1 THEN
    RAISE EXCEPTION 'Collateral loan must have at least one PRIMARY_BORROWER';
  END IF;

  IF v_signatory_count < 1 THEN
    RAISE EXCEPTION 'Collateral loan must have at least one signatory';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_collateral_loan_borrowers ON public.loan_borrowers;
CREATE CONSTRAINT TRIGGER trg_validate_collateral_loan_borrowers
AFTER INSERT OR UPDATE OR DELETE
ON public.loan_borrowers
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.validate_collateral_loan_borrowers();
