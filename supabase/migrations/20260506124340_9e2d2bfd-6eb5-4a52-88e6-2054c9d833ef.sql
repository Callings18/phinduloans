DO $$
DECLARE
  loan_ids UUID[] := ARRAY['44fd0cc0-5320-4749-9d01-c1fd28e20fc1'::uuid, '7185ded8-4e87-44c9-ad3e-b0d83d9edc42'::uuid];
BEGIN
  DELETE FROM loan_repayments WHERE loan_id = ANY(loan_ids);
  DELETE FROM disbursements WHERE loan_id = ANY(loan_ids);
  DELETE FROM account_transactions WHERE reference_type = 'loan' AND reference_id = ANY(loan_ids);
  DELETE FROM loan_events WHERE loan_id = ANY(loan_ids);
  DELETE FROM payment_claims WHERE loan_id = ANY(loan_ids);
  DELETE FROM loan_applications WHERE id = ANY(loan_ids);
END $$;