
-- Drop duplicate triggers on loan_applications (keep one canonical of each)
DROP TRIGGER IF EXISTS enforce_loan_status_transition ON public.loan_applications;
DROP TRIGGER IF EXISTS enforce_loan_status_transition_trigger ON public.loan_applications;
-- Keep: trigger_enforce_loan_status

DROP TRIGGER IF EXISTS notify_loan_status ON public.loan_applications;
DROP TRIGGER IF EXISTS notify_loan_status_change_trigger ON public.loan_applications;
-- Keep: trigger_notify_loan_status_change

DROP TRIGGER IF EXISTS log_loan_changes_trigger ON public.loan_applications;
-- Keep: trigger_log_loan_updates

DROP TRIGGER IF EXISTS cancel_repayments_on_loan_closure_trigger ON public.loan_applications;
-- Keep: trigger_cancel_repayments_on_closure

-- Drop duplicate triggers on disbursements (this caused 52 repayments instead of 26)
DROP TRIGGER IF EXISTS generate_repayment_schedule_on_disbursement ON public.disbursements;
DROP TRIGGER IF EXISTS generate_schedule_on_disbursement ON public.disbursements;
-- Keep: trigger_generate_repayment_schedule (fires only when status='completed')

DROP TRIGGER IF EXISTS enforce_disbursement_status_transition_trigger ON public.disbursements;
-- Keep: trigger_enforce_disbursement_status
