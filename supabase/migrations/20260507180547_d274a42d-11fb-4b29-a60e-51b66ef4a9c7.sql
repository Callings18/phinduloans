
-- 1) Stop automatic nightly penalty cron. Penalties become manual via UI.
DO $$
DECLARE v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'lms-daily-apply-penalties';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

-- 2) Refactor schedule generator into a callable helper, and skip Sundays for ALL cadences.
CREATE OR REPLACE FUNCTION public.generate_loan_schedule_for(p_loan_id uuid)
RETURNS void
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
  v_cursor_date DATE;
  v_count INTEGER;
  i INTEGER;
BEGIN
  -- Idempotency: don't regenerate if any schedule rows already exist.
  IF EXISTS (SELECT 1 FROM public.loan_repayments WHERE loan_id = p_loan_id) THEN
    RETURN;
  END IF;

  SELECT * INTO loan_record FROM public.loan_applications WHERE id = p_loan_id;
  IF loan_record IS NULL THEN RETURN; END IF;

  v_term_unit := COALESCE(loan_record.term_unit, 'months');
  v_repayment_frequency := 'monthly';

  IF loan_record.loan_product_id IS NOT NULL THEN
    SELECT term_unit, interest_period, repayment_frequency
    INTO product_record
    FROM public.loan_products
    WHERE id = loan_record.loan_product_id;

    IF product_record IS NOT NULL THEN
      v_term_unit := COALESCE(product_record.term_unit, v_term_unit);
      v_repayment_frequency := COALESCE(product_record.repayment_frequency, product_record.interest_period, 'monthly');
    END IF;
  END IF;

  IF v_term_unit = 'days' OR v_repayment_frequency = 'daily' THEN
    IF v_term_unit = 'days' THEN
      v_num_installments := loan_record.loan_term_months;
    ELSE
      v_num_installments := loan_record.loan_term_months * 26; -- Mon-Sat ~ 26/month
    END IF;
    v_payment := COALESCE(loan_record.total_repayment, loan_record.loan_amount) / GREATEST(v_num_installments, 1);

    v_cursor_date := CURRENT_DATE;
    v_count := 0;
    WHILE v_count < v_num_installments LOOP
      v_cursor_date := v_cursor_date + INTERVAL '1 day';
      IF EXTRACT(DOW FROM v_cursor_date) <> 0 THEN
        v_count := v_count + 1;
        INSERT INTO public.loan_repayments (loan_id, user_id, amount, original_amount, due_date, status, installment_number)
        VALUES (p_loan_id, loan_record.user_id, v_payment, v_payment, v_cursor_date, 'pending', v_count);
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
      -- Push Sunday to Monday
      IF EXTRACT(DOW FROM v_due_date) = 0 THEN
        v_due_date := v_due_date + INTERVAL '1 day';
      END IF;
      INSERT INTO public.loan_repayments (loan_id, user_id, amount, original_amount, due_date, status, installment_number)
      VALUES (p_loan_id, loan_record.user_id, v_payment, v_payment, v_due_date, 'pending', i);
    END LOOP;

  ELSE
    v_num_installments := loan_record.loan_term_months;
    v_payment := COALESCE(loan_record.monthly_payment,
                          COALESCE(loan_record.total_repayment, loan_record.loan_amount) / GREATEST(v_num_installments, 1));

    FOR i IN 1..v_num_installments LOOP
      v_due_date := (CURRENT_DATE + (i * INTERVAL '1 month'))::DATE;
      IF EXTRACT(DOW FROM v_due_date) = 0 THEN
        v_due_date := v_due_date + INTERVAL '1 day';
      END IF;
      INSERT INTO public.loan_repayments (loan_id, user_id, amount, original_amount, due_date, status, installment_number)
      VALUES (p_loan_id, loan_record.user_id, v_payment, v_payment, v_due_date, 'pending', i);
    END LOOP;
  END IF;
END;
$function$;

-- 3) Reuse helper from the existing disbursement trigger.
CREATE OR REPLACE FUNCTION public.generate_repayment_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    PERFORM public.generate_loan_schedule_for(NEW.loan_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- 4) New trigger: when a loan_application moves to 'active', auto-generate the schedule
--    if it doesn't already exist. This is the safety net for loans whose disbursement row
--    was created/edited outside the standard flow (e.g. bulk imports, manual reconciliations).
CREATE OR REPLACE FUNCTION public.trg_loan_active_generate_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status <> 'active') THEN
    PERFORM public.generate_loan_schedule_for(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_loan_active_generate_schedule ON public.loan_applications;
CREATE TRIGGER trigger_loan_active_generate_schedule
AFTER INSERT OR UPDATE OF status ON public.loan_applications
FOR EACH ROW
WHEN (NEW.status = 'active')
EXECUTE FUNCTION public.trg_loan_active_generate_schedule();
