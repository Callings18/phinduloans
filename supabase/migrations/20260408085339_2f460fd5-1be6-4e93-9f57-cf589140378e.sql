
-- ============================================================
-- RE-CREATE ALL MISSING TRIGGERS
-- ============================================================

-- 1. Repayment schedule generation on disbursement completion
DROP TRIGGER IF EXISTS trigger_generate_repayment_schedule ON public.disbursements;
CREATE TRIGGER trigger_generate_repayment_schedule
  AFTER INSERT OR UPDATE OF status ON public.disbursements
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION public.generate_repayment_schedule();

-- 2. Loan status transition enforcement
DROP TRIGGER IF EXISTS trigger_enforce_loan_status ON public.loan_applications;
CREATE TRIGGER trigger_enforce_loan_status
  BEFORE UPDATE OF status ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_loan_application_status_transition();

-- 3. Disbursement status transition enforcement
DROP TRIGGER IF EXISTS trigger_enforce_disbursement_status ON public.disbursements;
CREATE TRIGGER trigger_enforce_disbursement_status
  BEFORE UPDATE OF status ON public.disbursements
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_disbursement_status_transition();

-- 4. Payroll status transition enforcement
DROP TRIGGER IF EXISTS trigger_enforce_payroll_status ON public.payroll_runs;
CREATE TRIGGER trigger_enforce_payroll_status
  BEFORE UPDATE OF status ON public.payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_payroll_run_status_transition();

-- 5. Loan status change notifications
DROP TRIGGER IF EXISTS trigger_notify_loan_status_change ON public.loan_applications;
CREATE TRIGGER trigger_notify_loan_status_change
  AFTER UPDATE OF status ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_loan_status_change();

-- 6. Disbursement notifications
DROP TRIGGER IF EXISTS trigger_notify_disbursement ON public.disbursements;
CREATE TRIGGER trigger_notify_disbursement
  AFTER INSERT OR UPDATE OF status ON public.disbursements
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_disbursement();

-- 7. Payment received notifications
DROP TRIGGER IF EXISTS trigger_notify_payment_received ON public.loan_repayments;
CREATE TRIGGER trigger_notify_payment_received
  AFTER UPDATE OF status ON public.loan_repayments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_received();

-- 8. Loan change audit logging
DROP TRIGGER IF EXISTS trigger_log_loan_updates ON public.loan_applications;
CREATE TRIGGER trigger_log_loan_updates
  AFTER UPDATE ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.log_loan_changes();

-- 9. Repayment insert audit logging
DROP TRIGGER IF EXISTS trigger_log_repayment ON public.loan_repayments;
CREATE TRIGGER trigger_log_repayment
  AFTER INSERT ON public.loan_repayments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_repayment_activity();

-- 10. Cancel repayments on loan closure
DROP TRIGGER IF EXISTS trigger_cancel_repayments_on_closure ON public.loan_applications;
CREATE TRIGGER trigger_cancel_repayments_on_closure
  AFTER UPDATE OF status ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_repayments_on_loan_closure();

-- 11. Updated_at auto-timestamps
DROP TRIGGER IF EXISTS update_loan_applications_updated_at ON public.loan_applications;
CREATE TRIGGER update_loan_applications_updated_at
  BEFORE UPDATE ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_loan_products_updated_at ON public.loan_products;
CREATE TRIGGER update_loan_products_updated_at
  BEFORE UPDATE ON public.loan_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_employers_updated_at ON public.employers;
CREATE TRIGGER update_employers_updated_at
  BEFORE UPDATE ON public.employers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_collection_assignments_updated_at ON public.collection_assignments;
CREATE TRIGGER update_collection_assignments_updated_at
  BEFORE UPDATE ON public.collection_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- BACKFILL: Generate schedules for disbursed loans with no repayments
-- and set them to active
-- ============================================================
DO $$
DECLARE
  loan_rec RECORD;
  product_rec RECORD;
  v_term_unit TEXT;
  v_repayment_frequency TEXT;
  v_num_installments INTEGER;
  v_payment NUMERIC;
  v_due_date DATE;
  i INTEGER;
BEGIN
  FOR loan_rec IN
    SELECT la.*
    FROM public.loan_applications la
    WHERE la.status = 'disbursed'
      AND NOT EXISTS (
        SELECT 1 FROM public.loan_repayments lr WHERE lr.loan_id = la.id
      )
  LOOP
    v_term_unit := COALESCE(loan_rec.term_unit, 'months');
    v_repayment_frequency := 'monthly';

    IF loan_rec.loan_product_id IS NOT NULL THEN
      SELECT term_unit, interest_period, repayment_frequency
      INTO product_rec
      FROM public.loan_products
      WHERE id = loan_rec.loan_product_id;

      IF product_rec IS NOT NULL THEN
        v_term_unit := COALESCE(product_rec.term_unit, v_term_unit);
        v_repayment_frequency := COALESCE(product_rec.repayment_frequency, product_rec.interest_period, 'monthly');
      END IF;
    END IF;

    IF v_term_unit = 'days' OR v_repayment_frequency = 'daily' THEN
      IF v_term_unit = 'days' THEN
        v_num_installments := loan_rec.loan_term_months;
      ELSE
        v_num_installments := loan_rec.loan_term_months * 30;
      END IF;
      v_payment := COALESCE(loan_rec.total_repayment, loan_rec.loan_amount) / GREATEST(v_num_installments, 1);
      FOR i IN 1..v_num_installments LOOP
        v_due_date := (CURRENT_DATE + (i * INTERVAL '1 day'))::DATE;
        INSERT INTO public.loan_repayments (loan_id, user_id, amount, due_date, status, installment_number)
        VALUES (loan_rec.id, loan_rec.user_id, v_payment, v_due_date, 'pending', i);
      END LOOP;
    ELSIF v_term_unit = 'weeks' OR v_repayment_frequency = 'weekly' THEN
      IF v_term_unit = 'weeks' THEN
        v_num_installments := loan_rec.loan_term_months;
      ELSE
        v_num_installments := loan_rec.loan_term_months * 4;
      END IF;
      v_payment := COALESCE(loan_rec.total_repayment, loan_rec.loan_amount) / GREATEST(v_num_installments, 1);
      FOR i IN 1..v_num_installments LOOP
        v_due_date := (CURRENT_DATE + (i * 7 * INTERVAL '1 day'))::DATE;
        INSERT INTO public.loan_repayments (loan_id, user_id, amount, due_date, status, installment_number)
        VALUES (loan_rec.id, loan_rec.user_id, v_payment, v_due_date, 'pending', i);
      END LOOP;
    ELSE
      v_num_installments := loan_rec.loan_term_months;
      v_payment := loan_rec.monthly_payment;
      IF v_payment IS NULL OR v_payment = 0 THEN
        v_payment := COALESCE(loan_rec.total_repayment, loan_rec.loan_amount) / GREATEST(v_num_installments, 1);
      END IF;
      FOR i IN 1..v_num_installments LOOP
        v_due_date := (CURRENT_DATE + (i * INTERVAL '1 month'))::DATE;
        INSERT INTO public.loan_repayments (loan_id, user_id, amount, due_date, status, installment_number)
        VALUES (loan_rec.id, loan_rec.user_id, v_payment, v_due_date, 'pending', i);
      END LOOP;
    END IF;

    -- Set loan to active (bypass trigger by using direct update with same pattern)
    UPDATE public.loan_applications SET status = 'active' WHERE id = loan_rec.id;
  END LOOP;
END;
$$;
