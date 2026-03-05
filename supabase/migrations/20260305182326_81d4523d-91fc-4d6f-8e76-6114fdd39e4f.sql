-- Enable realtime for repayments and disbursements (loan_applications already enabled)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.loan_repayments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.disbursements;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;