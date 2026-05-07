
-- Backfill missing 26-day Mon-Sat repayment schedules for marketeer loans created yesterday
DO $$
DECLARE
  loan_rec RECORD;
  d DATE;
  inst_num INT;
  daily_amt NUMERIC;
BEGIN
  FOR loan_rec IN
    SELECT la.id, la.user_id, la.monthly_payment, la.total_repayment
    FROM loan_applications la
    WHERE la.loan_product_id = (SELECT id FROM loan_products WHERE product_code='MARKETEER')
      AND la.status IN ('active','disbursed')
      AND NOT EXISTS (SELECT 1 FROM loan_repayments lr WHERE lr.loan_id = la.id)
  LOOP
    daily_amt := COALESCE(loan_rec.monthly_payment, ROUND(loan_rec.total_repayment / 26.0, 2));
    d := CURRENT_DATE;
    inst_num := 0;
    WHILE inst_num < 26 LOOP
      IF EXTRACT(DOW FROM d) <> 0 THEN  -- skip Sundays
        inst_num := inst_num + 1;
        INSERT INTO loan_repayments (loan_id, user_id, installment_number, amount, due_date, status, principal_paid, penalty_amount, penalty_paid, interest_paid)
        VALUES (loan_rec.id, loan_rec.user_id, inst_num, daily_amt, d, 'pending', 0, 0, 0, 0);
      END IF;
      d := d + 1;
    END LOOP;
  END LOOP;
END $$;
