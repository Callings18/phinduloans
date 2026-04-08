
-- Remove old duplicate triggers (keep the new trigger_ prefixed ones)
DROP TRIGGER IF EXISTS trg_enforce_loan_application_status_transition ON public.loan_applications;
DROP TRIGGER IF EXISTS trg_cancel_repayments_on_closure ON public.loan_applications;
DROP TRIGGER IF EXISTS trg_enforce_disbursement_status_transition ON public.disbursements;
DROP TRIGGER IF EXISTS trg_enforce_payroll_run_status_transition ON public.payroll_runs;
DROP TRIGGER IF EXISTS trigger_enforce_payroll_status ON public.payroll_runs;
-- Re-create the single payroll trigger
CREATE TRIGGER trigger_enforce_payroll_status
  BEFORE UPDATE OF status ON public.payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_payroll_run_status_transition();
-- Also remove duplicate trigger_notify_disbursement if it references a non-existent function
DROP TRIGGER IF EXISTS trigger_notify_disbursement ON public.disbursements;
-- Remove duplicate repayment log trigger
DROP TRIGGER IF EXISTS trigger_log_repayment_insert ON public.loan_repayments;
