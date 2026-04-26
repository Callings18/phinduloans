-- Fix: Disbursement status race condition
-- Problem: generate_repayment_schedule() sets loan status to 'active', but the frontend
--          then overwrites it to 'disbursed', leaving loans stuck in 'disbursed' status.
-- Solution:
--   1. Update generate_repayment_schedule() to also set disbursed_at and approval_stage
--   2. Data migration: Fix any loans stuck in 'disbursed' that have repayment schedules
--      (they should be 'active')

-- ============================================================
-- 1. Update generate_repayment_schedule() trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_repayment_schedule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  loan_record RECORD;
  product_record RECORD;
  v_payment NUMERIC;
  v_due_date DATE;
  v_num_installments INTEGER;
  v_term_unit TEXT;
  v_repayment_frequency TEXT;
  v_product_code TEXT;
  v_cursor_date DATE;
  v_count INTEGER;
  i INTEGER;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT * INTO loan_record FROM public.loan_applications WHERE id = NEW.loan_id;
    
    IF loan_record IS NOT NULL THEN
      v_term_unit := COALESCE(loan_record.term_unit, 'months');
      v_repayment_frequency := 'monthly';
      v_product_code := NULL;

      IF loan_record.loan_product_id IS NOT NULL THEN
        SELECT term_unit, interest_period, repayment_frequency, product_code
        INTO product_record
        FROM public.loan_products
        WHERE id = loan_record.loan_product_id;

        IF product_record IS NOT NULL THEN
          v_term_unit := COALESCE(product_record.term_unit, v_term_unit);
          v_repayment_frequency := COALESCE(product_record.repayment_frequency, product_record.interest_period, 'monthly');
          v_product_code := product_record.product_code;
        END IF;
      END IF;

      IF v_term_unit = 'days' OR v_repayment_frequency = 'daily' THEN
        IF v_term_unit = 'days' THEN
          v_num_installments := loan_record.loan_term_months;
        ELSE
          v_num_installments := loan_record.loan_term_months * 30;
        END IF;
        v_payment := COALESCE(loan_record.total_repayment, loan_record.loan_amount) / GREATEST(v_num_installments, 1);

        -- For Marketeer and daily products: skip weekends (Sat=6, Sun=0)
        v_cursor_date := CURRENT_DATE;
        v_count := 0;
        WHILE v_count < v_num_installments LOOP
          v_cursor_date := v_cursor_date + INTERVAL '1 day';
          -- Skip Saturday (6) and Sunday (0)
          IF EXTRACT(DOW FROM v_cursor_date) NOT IN (0, 6) THEN
            v_count := v_count + 1;
            INSERT INTO public.loan_repayments (loan_id, user_id, amount, due_date, status, installment_number)
            VALUES (NEW.loan_id, loan_record.user_id, v_payment, v_cursor_date, 'pending', v_count);
          END IF;
        END LOOP;

      ELSIF v_term_unit = 'weeks' OR v_repayment_frequency = 'weekly' THEN
        IF v_term_unit = 'weeks' THEN
          v_num_installments := loan_record.loan_term_months;
        ELSE
          v_num_installments := loan_record.loan_term_months * 4;
        END IF;
        v_payment := COALESCE(loan_record.total_repayment, loan_record.loan_amount) / GREATEST(v_num_installments, 1);

        FOR i IN 1..v_num_installments LOOP
          v_due_date := (CURRENT_DATE + (i * 7 * INTERVAL '1 day'))::DATE;
          INSERT INTO public.loan_repayments (loan_id, user_id, amount, due_date, status, installment_number)
          VALUES (NEW.loan_id, loan_record.user_id, v_payment, v_due_date, 'pending', i);
        END LOOP;

      ELSE
        v_num_installments := loan_record.loan_term_months;
        v_payment := loan_record.monthly_payment;
        IF v_payment IS NULL OR v_payment = 0 THEN
          v_payment := COALESCE(loan_record.total_repayment, loan_record.loan_amount) / GREATEST(v_num_installments, 1);
        END IF;

        FOR i IN 1..v_num_installments LOOP
          v_due_date := (CURRENT_DATE + (i * INTERVAL '1 month'))::DATE;
          INSERT INTO public.loan_repayments (loan_id, user_id, amount, due_date, status, installment_number)
          VALUES (NEW.loan_id, loan_record.user_id, v_payment, v_due_date, 'pending', i);
        END LOOP;
      END IF;

      -- Transition loan to 'active' and ensure disbursed_at is set.
      -- This is the SINGLE source of truth for the disbursed→active transition.
      UPDATE public.loan_applications
      SET status = 'active',
          disbursed_at = COALESCE(disbursed_at, now()),
          approval_stage = 'active'
      WHERE id = NEW.loan_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.generate_repayment_schedule() IS
  'Generates repayment schedule on disbursement completion and transitions loan to active. Single source of truth for disbursed→active transition.';


-- ============================================================
-- 2. DATA MIGRATION: Fix loans stuck in 'disbursed' status
-- ============================================================
-- Loans with status 'disbursed' that already have a repayment schedule
-- should be 'active' — they were victims of the race condition.

UPDATE public.loan_applications la
SET status = 'active',
    approval_stage = 'active',
    updated_at = now()
WHERE la.status = 'disbursed'
  AND EXISTS (
    SELECT 1 FROM public.loan_repayments lr
    WHERE lr.loan_id = la.id
  );

-- Record the fix in audit_logs
INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  'DATA_MIGRATION_FIX',
  'loan_application',
  la.id,
  'loans',
  jsonb_build_object(
    'fix', 'disbursement_status_race',
    'from_status', 'disbursed',
    'to_status', 'active',
    'reason', 'Loan had repayment schedule but was stuck in disbursed due to frontend race condition'
  )
FROM public.loan_applications la
WHERE la.status = 'active'
  AND la.approval_stage = 'active'
  AND la.updated_at >= now() - INTERVAL '1 second';

-- Log status transitions for affected loans
INSERT INTO public.loan_status_transitions (loan_id, from_status, to_status, actor_type, actor_id, reason_text)
SELECT
  la.id,
  'disbursed',
  'active',
  'system',
  '00000000-0000-0000-0000-000000000000'::uuid,
  'Automated fix: loan had repayment schedule but was stuck in disbursed due to frontend race condition (migration 20260426210000)'
FROM public.loan_applications la
WHERE la.status = 'active'
  AND la.approval_stage = 'active'
  AND la.updated_at >= now() - INTERVAL '1 second';
