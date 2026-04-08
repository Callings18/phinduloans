
-- 1. Enforce status transitions on loan_applications
CREATE TRIGGER enforce_loan_status_transition
  BEFORE UPDATE OF status ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_loan_application_status_transition();

-- 2. Generate repayment schedule when disbursement completes
CREATE TRIGGER generate_schedule_on_disbursement
  AFTER INSERT OR UPDATE OF status ON public.disbursements
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_repayment_schedule();

-- 3. Notify on loan status change
CREATE TRIGGER notify_loan_status
  AFTER UPDATE OF status ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_loan_status_change();
