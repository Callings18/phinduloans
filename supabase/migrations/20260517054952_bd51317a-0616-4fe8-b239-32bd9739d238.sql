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
  v_product_code TEXT;
  v_anchor_date DATE;
  v_has_explicit_start BOOLEAN;
  v_cursor_date DATE;
  v_count INTEGER;
  i INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM public.loan_repayments WHERE loan_id = p_loan_id) THEN
    RETURN;
  END IF;

  SELECT * INTO loan_record FROM public.loan_applications WHERE id = p_loan_id;
  IF loan_record IS NULL THEN
    RETURN;
  END IF;

  v_term_unit := COALESCE(loan_record.term_unit, 'months');
  v_repayment_frequency := 'monthly';
  v_product_code := NULL;
  v_has_explicit_start := loan_record.repayment_start_date IS NOT NULL;

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

  v_anchor_date := COALESCE(loan_record.repayment_start_date, loan_record.disbursed_at::date, CURRENT_DATE);

  IF v_product_code = 'PAYDAY_SOFT' OR v_repayment_frequency = 'bullet' THEN
    v_payment := COALESCE(loan_record.total_repayment, loan_record.loan_amount, 0);
    v_due_date := CASE
      WHEN v_has_explicit_start THEN v_anchor_date
      ELSE (v_anchor_date + (COALESCE(NULLIF(loan_record.loan_term_months, 0), 30) * INTERVAL '1 day'))::date
    END;

    INSERT INTO public.loan_repayments (loan_id, user_id, amount, original_amount, due_date, status, installment_number)
    VALUES (p_loan_id, loan_record.user_id, v_payment, v_payment, v_due_date, 'pending', 1);

  ELSIF v_term_unit = 'days' OR v_repayment_frequency = 'daily' THEN
    IF v_term_unit = 'days' THEN
      v_num_installments := loan_record.loan_term_months;
    ELSE
      v_num_installments := loan_record.loan_term_months * 26;
    END IF;

    v_payment := COALESCE(loan_record.total_repayment, loan_record.loan_amount) / GREATEST(v_num_installments, 1);
    v_cursor_date := CASE WHEN v_has_explicit_start THEN v_anchor_date - INTERVAL '1 day' ELSE v_anchor_date END;
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
      v_due_date := (v_anchor_date + ((CASE WHEN v_has_explicit_start THEN i - 1 ELSE i END) * 7 * INTERVAL '1 day'))::DATE;
      IF EXTRACT(DOW FROM v_due_date) = 0 THEN
        v_due_date := v_due_date + INTERVAL '1 day';
      END IF;
      INSERT INTO public.loan_repayments (loan_id, user_id, amount, original_amount, due_date, status, installment_number)
      VALUES (p_loan_id, loan_record.user_id, v_payment, v_payment, v_due_date, 'pending', i);
    END LOOP;

  ELSE
    v_num_installments := loan_record.loan_term_months;
    v_payment := COALESCE(
      loan_record.monthly_payment,
      COALESCE(loan_record.total_repayment, loan_record.loan_amount) / GREATEST(v_num_installments, 1)
    );

    FOR i IN 1..v_num_installments LOOP
      v_due_date := (v_anchor_date + ((CASE WHEN v_has_explicit_start THEN i - 1 ELSE i END) * INTERVAL '1 month'))::DATE;
      IF EXTRACT(DOW FROM v_due_date) = 0 THEN
        v_due_date := v_due_date + INTERVAL '1 day';
      END IF;
      INSERT INTO public.loan_repayments (loan_id, user_id, amount, original_amount, due_date, status, installment_number)
      VALUES (p_loan_id, loan_record.user_id, v_payment, v_payment, v_due_date, 'pending', i);
    END LOOP;
  END IF;
END;
$function$;