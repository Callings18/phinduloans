-- Fix penalty calculation: use loan principal (loan_amount) instead of installment amount
CREATE OR REPLACE FUNCTION public.calculate_repayment_penalty(p_repayment_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan_id uuid;
  v_due_date date;
  v_days_overdue integer;
  v_penalty_rate numeric;
  v_grace_period integer;
  v_penalty numeric;
  v_loan_amount numeric;  -- principal sum
BEGIN
  -- Verify caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get repayment details
  SELECT loan_id, due_date
  INTO v_loan_id, v_due_date
  FROM public.loan_repayments
  WHERE id = p_repayment_id;
  
  IF v_loan_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate days overdue
  v_days_overdue := CURRENT_DATE - v_due_date;
  IF v_days_overdue <= 0 THEN
    RETURN 0;
  END IF;
  
  -- Get penalty rate, grace period, and PRINCIPAL from loan product
  SELECT 
    COALESCE(lp.late_payment_penalty_percent, 5),
    COALESCE(lp.grace_period_days, 0),
    la.loan_amount  -- Use principal sum, not installment amount
  INTO v_penalty_rate, v_grace_period, v_loan_amount
  FROM public.loan_applications la
  LEFT JOIN public.loan_products lp ON la.loan_product_id = lp.id
  WHERE la.id = v_loan_id;
  
  -- Apply grace period
  v_days_overdue := v_days_overdue - v_grace_period;
  IF v_days_overdue <= 0 THEN
    RETURN 0;
  END IF;
  
  -- Calculate penalty on PRINCIPAL (monthly rate applied per month overdue)
  v_penalty := v_loan_amount * (v_penalty_rate / 100) * CEIL(v_days_overdue::numeric / 30);
  
  -- Update the repayment record with calculated penalty
  UPDATE public.loan_repayments
  SET penalty_amount = v_penalty
  WHERE id = p_repayment_id;
  
  RETURN v_penalty;
END;
$$;