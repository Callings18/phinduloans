-- Fix DEFINER_OR_RPC_BYPASS: Add authorization checks to SECURITY DEFINER functions

-- 1. Update calculate_repayment_penalty with authorization
CREATE OR REPLACE FUNCTION public.calculate_repayment_penalty(p_repayment_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_due_date date;
  v_amount numeric;
  v_loan_id uuid;
  v_penalty_rate numeric;
  v_days_overdue integer;
  v_penalty numeric;
  v_user_id uuid;
  v_is_authorized boolean := false;
BEGIN
  -- Get calling user
  v_user_id := auth.uid();
  
  -- Get repayment details
  SELECT due_date, amount, loan_id INTO v_due_date, v_amount, v_loan_id
  FROM public.loan_repayments
  WHERE id = p_repayment_id AND status = 'pending';
  
  IF v_due_date IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Check authorization: staff roles OR loan owner
  v_is_authorized := (
    public.has_role(v_user_id, 'admin'::app_role)
    OR public.has_role(v_user_id, 'super_admin'::app_role)
    OR public.has_role(v_user_id, 'collections_officer'::app_role)
    OR public.has_role(v_user_id, 'loan_officer'::app_role)
    OR public.has_role(v_user_id, 'finance_officer'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.loan_applications 
      WHERE id = v_loan_id AND user_id = v_user_id
    )
  );
  
  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: You do not have permission to access this loan';
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
$function$;

-- 2. Update apply_loan_penalties with authorization
CREATE OR REPLACE FUNCTION public.apply_loan_penalties(p_loan_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_penalty numeric := 0;
  v_repayment record;
  v_user_id uuid;
  v_is_authorized boolean := false;
BEGIN
  -- Get calling user
  v_user_id := auth.uid();
  
  -- Check authorization: staff roles OR loan owner
  v_is_authorized := (
    public.has_role(v_user_id, 'admin'::app_role)
    OR public.has_role(v_user_id, 'super_admin'::app_role)
    OR public.has_role(v_user_id, 'collections_officer'::app_role)
    OR public.has_role(v_user_id, 'loan_officer'::app_role)
    OR public.has_role(v_user_id, 'finance_officer'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.loan_applications 
      WHERE id = p_loan_id AND user_id = v_user_id
    )
  );
  
  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: You do not have permission to access this loan';
  END IF;

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
$function$;

-- 3. Update calculate_early_settlement with authorization
CREATE OR REPLACE FUNCTION public.calculate_early_settlement(p_loan_id uuid)
RETURNS TABLE(outstanding_principal numeric, outstanding_interest numeric, total_penalties numeric, early_settlement_fee numeric, total_payoff_amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_loan record;
  v_product record;
  v_total_paid numeric;
  v_total_due numeric;
  v_outstanding numeric;
  v_early_fee_rate numeric;
  v_early_fee numeric;
  v_penalties numeric;
  v_user_id uuid;
  v_is_authorized boolean := false;
BEGIN
  -- Get calling user
  v_user_id := auth.uid();
  
  -- Get loan details
  SELECT * INTO v_loan FROM public.loan_applications WHERE id = p_loan_id;
  
  IF v_loan IS NULL THEN
    RETURN;
  END IF;
  
  -- Check authorization: staff roles OR loan owner
  v_is_authorized := (
    public.has_role(v_user_id, 'admin'::app_role)
    OR public.has_role(v_user_id, 'super_admin'::app_role)
    OR public.has_role(v_user_id, 'collections_officer'::app_role)
    OR public.has_role(v_user_id, 'loan_officer'::app_role)
    OR public.has_role(v_user_id, 'finance_officer'::app_role)
    OR public.has_role(v_user_id, 'credit_officer'::app_role)
    OR (v_loan.user_id = v_user_id)
  );
  
  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: You do not have permission to access this loan';
  END IF;
  
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
$function$;

-- Fix STORAGE_EXPOSURE: Remove the unused insecure 'loan_documents' bucket

-- Drop the insecure policies first
DROP POLICY IF EXISTS "Allow authenticated users to upload loan documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to view own loan documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow staff to view all loan documents" ON storage.objects;

-- Delete any objects in the bucket (if any)
DELETE FROM storage.objects WHERE bucket_id = 'loan_documents';

-- Remove the bucket itself
DELETE FROM storage.buckets WHERE id = 'loan_documents';