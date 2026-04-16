
-- Fix: generate_repayment_schedule should skip weekends (Sat/Sun) for daily loans
-- This ensures Marketeer and other daily-collection products get Mon-Fri schedules
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

      UPDATE public.loan_applications SET status = 'active' WHERE id = NEW.loan_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
