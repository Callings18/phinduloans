-- Support admin report filters (date ranges, disbursement timeline, repayment schedules)

CREATE INDEX IF NOT EXISTS idx_loan_applications_reports_created_at
  ON public.loan_applications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_applications_reports_disbursed_at
  ON public.loan_applications (disbursed_at DESC)
  WHERE disbursed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loan_repayments_reports_due_date
  ON public.loan_repayments (due_date);

CREATE INDEX IF NOT EXISTS idx_loan_repayments_reports_loan_id
  ON public.loan_repayments (loan_id);
