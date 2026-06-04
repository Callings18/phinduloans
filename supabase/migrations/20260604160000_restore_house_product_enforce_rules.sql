-- Restore full enforce_house_product_rules() after collateral-only patch dropped Marketeer 26-day term (and other guards).

CREATE OR REPLACE FUNCTION public.enforce_house_product_rules()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  v_product_code TEXT;
  v_product_min_amount NUMERIC;
  v_product_max_amount NUMERIC;
  v_local_compliance BOOLEAN;
  v_business_months INTEGER;
  v_civil_confirmed BOOLEAN;
BEGIN
  SELECT lp.product_code, lp.min_amount, lp.max_amount
  INTO v_product_code, v_product_min_amount, v_product_max_amount
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
    IF coalesce(NEW.term_unit, 'months') <> 'months' OR coalesce(NEW.loan_term_months, 0) <> 1 THEN
      RAISE EXCEPTION 'Salary Advance term must be 1 month';
    END IF;
    v_product_min_amount := coalesce(v_product_min_amount, 500);
    v_product_max_amount := coalesce(v_product_max_amount, 10000);
    IF NEW.loan_amount < v_product_min_amount OR NEW.loan_amount > v_product_max_amount THEN
      RAISE EXCEPTION 'Salary Advance amount must be between % and %', v_product_min_amount, v_product_max_amount;
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
    IF coalesce(NEW.term_unit, 'months') <> 'months' OR coalesce(NEW.loan_term_months, 0) <> 1 THEN
      RAISE EXCEPTION 'Staff salary advance term must be 1 month';
    END IF;
    v_product_min_amount := coalesce(v_product_min_amount, 500);
    v_product_max_amount := coalesce(v_product_max_amount, 3000);
    IF NEW.loan_amount < v_product_min_amount OR NEW.loan_amount > v_product_max_amount THEN
      RAISE EXCEPTION 'Staff salary advance amount must be between % and %', v_product_min_amount, v_product_max_amount;
    END IF;
  END IF;

  IF v_product_code = 'BUSINESS' THEN
    IF NEW.employment_type IS DISTINCT FROM 'self_employed' AND NEW.employment_type IS DISTINCT FROM 'contract' THEN
      RAISE EXCEPTION 'Business loan is restricted to self-employed/contract borrowers';
    END IF;
  END IF;

  IF v_product_code = 'COLLATERAL' THEN
    IF coalesce(NEW.term_unit, 'months') <> 'months'
       OR coalesce(NEW.loan_term_months, 0) < 1
       OR coalesce(NEW.loan_term_months, 0) > 12 THEN
      RAISE EXCEPTION 'Collateral loan term must be between 1 and 12 months';
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
    v_product_min_amount := coalesce(v_product_min_amount, 1000);
    v_product_max_amount := coalesce(v_product_max_amount, 10000);
    IF NOT v_local_compliance THEN
      RAISE EXCEPTION 'Marketeer loans require local authority compliance confirmation';
    END IF;
    IF v_business_months < 6 THEN
      RAISE EXCEPTION 'Marketeer borrower business must exist for at least 6 months';
    END IF;
    IF NEW.loan_amount < v_product_min_amount OR NEW.loan_amount > v_product_max_amount THEN
      RAISE EXCEPTION 'Marketeer loan amount must be between % and %', v_product_min_amount, v_product_max_amount;
    END IF;
    IF coalesce(NEW.term_unit, 'days') <> 'days' OR coalesce(NEW.loan_term_months, 0) <> 26 THEN
      RAISE EXCEPTION 'Marketeer term must be 26 collection days';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
