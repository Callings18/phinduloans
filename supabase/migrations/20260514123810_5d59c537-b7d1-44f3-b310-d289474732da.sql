-- Backfill missing document records from private storage objects into application_documents.
WITH loan_objects AS (
  SELECT
    la.id AS loan_id,
    la.user_id AS borrower_id,
    la.loan_product_id,
    o.name AS file_url,
    split_part(o.name, '/', array_length(string_to_array(o.name, '/'), 1)) AS file_name,
    COALESCE((o.metadata ->> 'mimetype'), (o.metadata ->> 'mimeType')) AS mime_type,
    NULLIF(o.metadata ->> 'size', '')::bigint AS file_size,
    o.owner::text AS uploaded_by,
    o.created_at,
    CASE
      WHEN o.name LIKE la.id::text || '/%' THEN split_part(o.name, '/', 2)
      WHEN o.name LIKE 'loan-docs/%/' || la.id::text || '/%' THEN regexp_replace(split_part(o.name, '/', 4), '\.[^.]+$', '')
      WHEN o.name LIKE 'contracts/contract_' || la.id::text || '_%' THEN 'contract'
      ELSE 'document'
    END AS raw_doc_type
  FROM public.loan_applications la
  JOIN storage.objects o
    ON o.bucket_id = 'loan-documents'
   AND (
     o.name LIKE la.id::text || '/%'
     OR o.name LIKE 'loan-docs/%/' || la.id::text || '/%'
     OR o.name LIKE 'contracts/contract_' || la.id::text || '_%'
   )
  WHERE la.user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.application_documents ad
      WHERE ad.application_id = la.id
        AND ad.file_url = o.name
    )
)
INSERT INTO public.application_documents (
  application_id,
  borrower_id,
  loan_product_id,
  doc_type,
  doc_label,
  file_url,
  file_name,
  mime_type,
  file_size,
  uploaded_by,
  status,
  uploaded_at
)
SELECT
  loan_id,
  borrower_id,
  loan_product_id,
  lower(regexp_replace(raw_doc_type, '[^a-zA-Z0-9_]+', '_', 'g')),
  CASE
    WHEN raw_doc_type = 'nrc_front' THEN 'NRC Front'
    WHEN raw_doc_type = 'nrc_back' THEN 'NRC Back'
    WHEN raw_doc_type = 'selfie_holding_nrc' THEN 'Selfie Holding NRC'
    WHEN raw_doc_type = 'proof_of_residence' THEN 'Proof of Residence'
    WHEN raw_doc_type = 'bank_statement_1' THEN 'Bank Statement'
    WHEN raw_doc_type = 'payslip_1' THEN 'Payslip 1'
    WHEN raw_doc_type = 'contract' THEN 'Generated Contract'
    ELSE initcap(replace(regexp_replace(raw_doc_type, '_[0-9]{10,}$', ''), '_', ' '))
  END,
  file_url,
  COALESCE(NULLIF(file_name, ''), 'uploaded-document'),
  mime_type,
  file_size,
  uploaded_by,
  'uploaded',
  COALESCE(created_at, now())
FROM loan_objects;

-- Ensure Payday Soft loans created before the product-rule trigger was attached keep the correct term unit.
UPDATE public.loan_applications la
SET term_unit = 'days', updated_at = now()
FROM public.loan_products lp
WHERE la.loan_product_id = lp.id
  AND lp.product_code = 'PAYDAY_SOFT'
  AND la.term_unit IS DISTINCT FROM 'days';

-- Rebuild unpaid Payday Soft schedules that were anchored before the disbursement date.
WITH target_loans AS (
  SELECT
    la.id,
    la.user_id,
    la.disbursed_at::date AS anchor_date,
    COALESCE(la.total_repayment, la.loan_amount, 0) AS total_repayment,
    COALESCE(la.loan_term_months, 30) AS installments
  FROM public.loan_applications la
  JOIN public.loan_products lp ON lp.id = la.loan_product_id
  WHERE lp.product_code = 'PAYDAY_SOFT'
    AND la.disbursed_at IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.loan_repayments lr
      WHERE lr.loan_id = la.id
        AND lr.status IN ('pending', 'overdue')
        AND lr.due_date < la.disbursed_at::date
    )
), deleted AS (
  DELETE FROM public.loan_repayments lr
  USING target_loans tl
  WHERE lr.loan_id = tl.id
    AND lr.status IN ('pending', 'overdue')
  RETURNING lr.loan_id
), generated AS (
  SELECT
    tl.id AS loan_id,
    tl.user_id,
    round(tl.total_repayment / GREATEST(tl.installments, 1), 2) AS amount,
    gs.installment_number,
    (tl.anchor_date + (gs.installment_number * INTERVAL '1 day'))::date AS due_date
  FROM target_loans tl
  CROSS JOIN LATERAL generate_series(1, tl.installments) AS gs(installment_number)
)
INSERT INTO public.loan_repayments (loan_id, user_id, amount, original_amount, due_date, status, installment_number)
SELECT loan_id, user_id, amount, amount, due_date, 'pending', installment_number
FROM generated
ON CONFLICT DO NOTHING;

-- Harden future automatic schedule generation: no implicit schedule before disbursement for loans that have no explicit repayment start date.
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
  v_has_explicit_start := loan_record.repayment_start_date IS NOT NULL;

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

  -- If active status is reached without disbursed_at, anchor from today instead of application creation date.
  v_anchor_date := COALESCE(loan_record.repayment_start_date, loan_record.disbursed_at::date, CURRENT_DATE);

  IF v_term_unit = 'days' OR v_repayment_frequency = 'daily' THEN
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