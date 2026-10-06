-- Migration: Fix weekly payment schedules, interest calculations, and add deletion restrictions
-- Date: 2026-01-17
-- Description: 
--  1. Update repayment schedule generation to support weekly payments
--  2. Fix interest calculations for weekly loans
--  3. Add restrictions for loan and borrower deletion

-- ============================================================================
-- 1. UPDATE REPAYMENT SCHEDULE GENERATION FOR WEEKLY PAYMENTS
-- ============================================================================

-- Update the generate_repayment_schedule function to support weekly payments
CREATE OR REPLACE FUNCTION public.generate_repayment_schedule()
RETURNS TRIGGER AS $$
DECLARE
  loan_record RECORD;
  product_record RECORD;
  payment_amount NUMERIC;
  due_date DATE;
  i INTEGER;
  num_installments INTEGER;
  payment_interval INTERVAL;
  term_unit TEXT;
  interest_period TEXT;
  repayment_frequency TEXT;
  is_weekly BOOLEAN;
  is_daily BOOLEAN;
BEGIN
  -- Only run when status changes to 'completed' (disbursement completed)
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get loan details
    SELECT * INTO loan_record FROM public.loan_applications WHERE id = NEW.loan_id;
    
    IF loan_record IS NOT NULL THEN
      -- Get product details to check term_unit, interest_period, and repayment_frequency
      SELECT term_unit, interest_period, repayment_frequency INTO product_record
      FROM public.loan_products 
      WHERE id = loan_record.loan_product_id;
      
      -- Determine payment frequency
      term_unit := COALESCE(loan_record.term_unit, product_record.term_unit, 'months');
      interest_period := COALESCE(product_record.interest_period, 'monthly');
      repayment_frequency := COALESCE(product_record.repayment_frequency, 'monthly');
      
      -- Check payment frequency (daily, weekly, or monthly)
      is_weekly := (term_unit = 'weeks') OR 
                   (term_unit = 'months' AND (interest_period = 'weekly' OR repayment_frequency = 'weekly'));
      is_daily := (term_unit = 'days') OR 
                  (term_unit = 'months' AND (interest_period = 'daily' OR repayment_frequency = 'daily'));
      
      -- Calculate payment amount and interval
      IF is_daily THEN
        -- For daily loans
        payment_amount := loan_record.monthly_payment;
        IF payment_amount IS NULL OR payment_amount = 0 THEN
          IF term_unit = 'days' THEN
            payment_amount := loan_record.total_repayment / loan_record.loan_term_months;
          ELSE
            -- If term_unit is months but frequency is daily, convert
            payment_amount := (loan_record.total_repayment / loan_record.loan_term_months) / 30;
          END IF;
        ELSE
          payment_amount := payment_amount / 30;
        END IF;
        
        payment_interval := INTERVAL '1 day';
        num_installments := CASE 
          WHEN term_unit = 'days' THEN loan_record.loan_term_months
          ELSE loan_record.loan_term_months * 30
        END;
      ELSIF is_weekly THEN
        -- For weekly loans
        payment_amount := loan_record.monthly_payment;
        IF payment_amount IS NULL OR payment_amount = 0 THEN
          IF term_unit = 'weeks' THEN
            payment_amount := loan_record.total_repayment / loan_record.loan_term_months;
          ELSE
            -- If term_unit is months but frequency is weekly, convert
            payment_amount := (loan_record.total_repayment / loan_record.loan_term_months) / 4.33;
          END IF;
        ELSE
          payment_amount := payment_amount / 4.33;
        END IF;
        
        payment_interval := INTERVAL '7 days';
        num_installments := CASE 
          WHEN term_unit = 'weeks' THEN loan_record.loan_term_months
          ELSE loan_record.loan_term_months * 4
        END;
      ELSE
        -- For monthly loans
        payment_amount := loan_record.monthly_payment;
        IF payment_amount IS NULL OR payment_amount = 0 THEN
          payment_amount := loan_record.total_repayment / loan_record.loan_term_months;
        END IF;
        
        payment_interval := INTERVAL '1 month';
        num_installments := loan_record.loan_term_months;
      END IF;
      
      -- Generate repayment schedule
      FOR i IN 1..num_installments LOOP
        IF i = 1 THEN
          -- First payment due date
          IF is_daily THEN
            due_date := (CURRENT_DATE + INTERVAL '1 day')::DATE;
          ELSIF is_weekly THEN
            due_date := (CURRENT_DATE + INTERVAL '7 days')::DATE;
          ELSE
            due_date := (CURRENT_DATE + INTERVAL '1 month')::DATE;
          END IF;
        ELSE
          -- Subsequent payments
          due_date := (CURRENT_DATE + (i * payment_interval))::DATE;
        END IF;
        
        INSERT INTO public.loan_repayments (
          loan_id,
          user_id,
          amount,
          due_date,
          status,
          installment_number
        ) VALUES (
          NEW.loan_id,
          loan_record.user_id,
          payment_amount,
          due_date,
          'pending',
          i
        );
      END LOOP;
      
      -- Update loan status to active
      UPDATE public.loan_applications 
      SET status = 'active' 
      WHERE id = NEW.loan_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 2. ADD FUNCTION TO CHECK IF LOAN CAN BE DELETED
-- ============================================================================

-- Function to check if a loan can be deleted (only pending, rejected, or under_review)
CREATE OR REPLACE FUNCTION public.can_delete_loan(p_loan_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  loan_status TEXT;
BEGIN
  SELECT status INTO loan_status
  FROM public.loan_applications
  WHERE id = p_loan_id;
  
  -- Only allow deletion if loan is not approved or disbursed
  RETURN loan_status IN ('pending', 'rejected', 'under_review');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. ADD FUNCTION TO CHECK IF BORROWER CAN BE DELETED
-- ============================================================================

-- Function to check if a borrower can be deleted (no active loans)
CREATE OR REPLACE FUNCTION public.can_delete_borrower(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  active_loans_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_loans_count
  FROM public.loan_applications
  WHERE user_id = p_user_id
    AND status IN ('active', 'disbursed', 'approved', 'completed');
  
  -- Only allow deletion if borrower has no active loans
  RETURN active_loans_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. ADD RLS POLICIES FOR DELETION RESTRICTIONS
-- ============================================================================

-- Policy to prevent deletion of loans that are approved or disbursed
-- This will be enforced at the application level, but we add a comment for documentation
COMMENT ON FUNCTION public.can_delete_loan IS 'Checks if a loan can be deleted. Returns true only for pending, rejected, or under_review loans.';

COMMENT ON FUNCTION public.can_delete_borrower IS 'Checks if a borrower can be deleted. Returns true only if borrower has no active, disbursed, approved, or completed loans.';

-- ============================================================================
-- 5. UPDATE COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.generate_repayment_schedule IS 'Generates repayment schedule for loans. Supports both weekly and monthly payment frequencies based on term_unit and interest_period.';
