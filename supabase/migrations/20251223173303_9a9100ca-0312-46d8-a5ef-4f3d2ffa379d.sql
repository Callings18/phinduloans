-- Add columns for penalty tracking and payment allocation to loan_repayments
ALTER TABLE public.loan_repayments 
ADD COLUMN IF NOT EXISTS penalty_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS principal_paid numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS interest_paid numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS penalty_paid numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_reversed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reversed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS reversed_by uuid,
ADD COLUMN IF NOT EXISTS reversal_reason text,
ADD COLUMN IF NOT EXISTS original_amount numeric;

-- Add early settlement tracking to loan_applications
ALTER TABLE public.loan_applications
ADD COLUMN IF NOT EXISTS settlement_date date,
ADD COLUMN IF NOT EXISTS settlement_type text,
ADD COLUMN IF NOT EXISTS early_settlement_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_penalties numeric DEFAULT 0;

-- Create function to calculate penalty for overdue repayments
CREATE OR REPLACE FUNCTION public.calculate_repayment_penalty(
  p_repayment_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_due_date date;
  v_amount numeric;
  v_loan_id uuid;
  v_penalty_rate numeric;
  v_days_overdue integer;
  v_penalty numeric;
BEGIN
  -- Get repayment details
  SELECT due_date, amount, loan_id INTO v_due_date, v_amount, v_loan_id
  FROM public.loan_repayments
  WHERE id = p_repayment_id AND status = 'pending';
  
  IF v_due_date IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate days overdue
  v_days_overdue := CURRENT_DATE - v_due_date;
  
  IF v_days_overdue <= 0 THEN
    RETURN 0;
  END IF;
  
  -- Get penalty rate from loan product
  SELECT COALESCE(lp.late_payment_penalty_percent, 5) INTO v_penalty_rate
  FROM public.loan_applications la
  LEFT JOIN public.loan_products lp ON la.loan_product_id = lp.id
  WHERE la.id = v_loan_id;
  
  -- Calculate penalty (monthly rate applied per month overdue)
  v_penalty := v_amount * (v_penalty_rate / 100) * CEIL(v_days_overdue::numeric / 30);
  
  -- Update the repayment record with penalty
  UPDATE public.loan_repayments
  SET penalty_amount = v_penalty
  WHERE id = p_repayment_id;
  
  RETURN v_penalty;
END;
$$;

-- Create function to apply penalties to all overdue repayments for a loan
CREATE OR REPLACE FUNCTION public.apply_loan_penalties(
  p_loan_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_penalty numeric := 0;
  v_repayment record;
BEGIN
  FOR v_repayment IN 
    SELECT id FROM public.loan_repayments 
    WHERE loan_id = p_loan_id 
    AND status = 'pending' 
    AND due_date < CURRENT_DATE
  LOOP
    v_total_penalty := v_total_penalty + public.calculate_repayment_penalty(v_repayment.id);
  END LOOP;
  
  -- Update total penalties on loan
  UPDATE public.loan_applications
  SET total_penalties = v_total_penalty
  WHERE id = p_loan_id;
  
  RETURN v_total_penalty;
END;
$$;

-- Create function for early settlement calculation
CREATE OR REPLACE FUNCTION public.calculate_early_settlement(
  p_loan_id uuid
)
RETURNS TABLE(
  outstanding_principal numeric,
  outstanding_interest numeric,
  total_penalties numeric,
  early_settlement_fee numeric,
  total_payoff_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_loan record;
  v_product record;
  v_total_paid numeric;
  v_total_due numeric;
  v_outstanding numeric;
  v_early_fee_rate numeric;
  v_early_fee numeric;
  v_penalties numeric;
BEGIN
  -- Get loan details
  SELECT * INTO v_loan FROM public.loan_applications WHERE id = p_loan_id;
  
  -- Get product early repayment fee
  SELECT COALESCE(early_repayment_fee_percent, 0) INTO v_early_fee_rate
  FROM public.loan_products WHERE id = v_loan.loan_product_id;
  
  -- Calculate total paid
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.loan_repayments
  WHERE loan_id = p_loan_id AND status = 'paid';
  
  -- Calculate outstanding
  v_outstanding := v_loan.total_repayment - v_total_paid;
  
  -- Calculate penalties
  SELECT COALESCE(SUM(penalty_amount), 0) INTO v_penalties
  FROM public.loan_repayments
  WHERE loan_id = p_loan_id AND status = 'pending';
  
  -- Calculate early settlement fee on remaining principal
  v_early_fee := (v_loan.loan_amount - v_total_paid) * (v_early_fee_rate / 100);
  IF v_early_fee < 0 THEN v_early_fee := 0; END IF;
  
  RETURN QUERY SELECT 
    GREATEST(v_loan.loan_amount - v_total_paid, 0)::numeric as outstanding_principal,
    GREATEST(v_outstanding - (v_loan.loan_amount - v_total_paid), 0)::numeric as outstanding_interest,
    v_penalties::numeric as total_penalties,
    v_early_fee::numeric as early_settlement_fee,
    GREATEST(v_outstanding + v_penalties + v_early_fee, 0)::numeric as total_payoff_amount;
END;
$$;