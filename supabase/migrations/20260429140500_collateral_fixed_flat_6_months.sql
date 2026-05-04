-- Collateral product hardening: fixed 6-month flat structure with server-side guards.

-- Ensure the collateral product configuration is fixed and explicit.
UPDATE public.loan_products
SET
  interest_type = 'flat',
  term_unit = 'months',
  min_term_months = 6,
  max_term_months = 6,
  interest_period = 'monthly',
  interest_rate = 5,
  repayment_frequency = 'monthly',
  installment_structure = 'equal',
  description = COALESCE(
    NULLIF(trim(description), ''),
    'Collateral loan: fixed 6 monthly installments at 30% total interest (equivalent to 5% per month for display).'
  )
WHERE product_code = 'COLLATERAL';

-- Recreate rules function with collateral-specific fixed-term enforcement.
CREATE OR REPLACE FUNCTION public.enforce_house_product_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_product_code TEXT;
  v_local_compliance BOOLEAN;
  v_business_months INTEGER;
  v_civil_confirmed BOOLEAN;
BEGIN
  SELECT lp.product_code
  INTO v_product_code
  FROM public.loan_products lp
  WHERE lp.id = NEW.loan_product_id
  LIMIT 1;

  IF v_product_code IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_product_code = 'PAYDAY_SOFT' THEN
    IF lower(coalesce(NEW.city, '')) <> 'lusaka' THEN
      RAISE EXCEPTION 'Payday Soft loans are restricted to Lusaka';
    END IF;
    IF coalesce(NEW.term_unit, 'days') <> 'days' OR coalesce(NEW.loan_term_months, 0) <> 30 THEN
      RAISE EXCEPTION 'Payday Soft term must be exactly 30 days';
    END IF;
  END IF;

  IF v_product_code = 'SALARY_ADVANCE' THEN
    v_civil_confirmed := coalesce((NEW.product_specific_data ->> 'civil_servant_confirmed')::boolean, false);
    IF NOT v_civil_confirmed THEN
      RAISE EXCEPTION 'Salary Advance requires civil servant confirmation';
    END IF;
    IF NEW.employment_type IS DISTINCT FROM 'employed' AND NEW.employment_type IS DISTINCT FROM 'contract' THEN
      RAISE EXCEPTION 'Salary Advance is restricted to employed/contract borrowers';
    END IF;
  END IF;

  IF v_product_code = 'SALARY_ADVANCE_STAFF' THEN
    v_civil_confirmed := coalesce((NEW.product_specific_data ->> 'civil_servant_confirmed')::boolean, false);
    IF NOT v_civil_confirmed THEN
      RAISE EXCEPTION 'Staff salary advance requires eligibility confirmation';
    END IF;
    IF NEW.employment_type IS DISTINCT FROM 'employed' AND NEW.employment_type IS DISTINCT FROM 'contract' THEN
      RAISE EXCEPTION 'Staff salary advance is restricted to employed/contract borrowers';
    END IF;
  END IF;

  IF v_product_code = 'BUSINESS' THEN
    IF NEW.employment_type IS DISTINCT FROM 'self_employed' AND NEW.employment_type IS DISTINCT FROM 'contract' THEN
      RAISE EXCEPTION 'Business loan is restricted to self-employed/contract borrowers';
    END IF;
  END IF;

  IF v_product_code = 'COLLATERAL' THEN
    IF coalesce(NEW.term_unit, 'months') <> 'months' OR coalesce(NEW.loan_term_months, 0) <> 6 THEN
      RAISE EXCEPTION 'Collateral loan term must be fixed at 6 months';
    END IF;
  END IF;

  IF v_product_code = 'MOTOR_VEHICLE' THEN
    IF coalesce(NEW.term_unit, 'months') <> 'months'
       OR coalesce(NEW.loan_term_months, 0) < 3
       OR coalesce(NEW.loan_term_months, 0) > 24 THEN
      RAISE EXCEPTION 'Motor Vehicle term must be 3 to 24 months';
    END IF;
  END IF;

  IF v_product_code = 'MARKETEER' THEN
    v_local_compliance := coalesce((NEW.product_specific_data ->> 'local_authority_compliance')::boolean, false);
    v_business_months := coalesce((NEW.product_specific_data ->> 'business_months')::integer, 0);

    IF coalesce(NEW.loan_amount, 0) < 1000 OR coalesce(NEW.loan_amount, 0) > 10000 THEN
      RAISE EXCEPTION 'Marketeer loan amount must be between K1,000 and K10,000';
    END IF;
    IF coalesce(NEW.term_unit, 'days') <> 'days' OR coalesce(NEW.loan_term_months, 0) <> 26 THEN
      RAISE EXCEPTION 'Marketeer term must be 26 collection days';
    END IF;
    IF NOT v_local_compliance THEN
      RAISE EXCEPTION 'Marketeer requires local authority compliance confirmation';
    END IF;
    IF v_business_months < 6 THEN
      RAISE EXCEPTION 'Marketeer requires minimum 6 months in business';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
