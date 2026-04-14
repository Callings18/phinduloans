-- Re-create the disbursement trigger for repayment schedule generation
CREATE OR REPLACE TRIGGER generate_repayment_schedule_on_disbursement
  AFTER INSERT OR UPDATE ON public.disbursements
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_repayment_schedule();

-- Re-create loan status notification trigger
CREATE OR REPLACE TRIGGER notify_loan_status_change_trigger
  AFTER UPDATE ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_loan_status_change();

-- Re-create disbursement notification trigger  
CREATE OR REPLACE TRIGGER notify_disbursement_trigger
  AFTER INSERT OR UPDATE ON public.disbursements
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_disbursement();

-- Re-create payment received notification trigger
CREATE OR REPLACE TRIGGER notify_payment_received_trigger
  AFTER UPDATE ON public.loan_repayments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_received();

-- Re-create loan audit logging trigger
CREATE OR REPLACE TRIGGER log_loan_changes_trigger
  AFTER UPDATE ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.log_loan_changes();

-- Re-create repayment audit logging trigger
CREATE OR REPLACE TRIGGER log_repayment_activity_trigger
  AFTER INSERT ON public.loan_repayments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_repayment_activity();

-- Re-create cancel repayments on loan closure trigger
CREATE OR REPLACE TRIGGER cancel_repayments_on_loan_closure_trigger
  AFTER UPDATE ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_repayments_on_loan_closure();

-- Re-create disbursement status transition enforcement
CREATE OR REPLACE TRIGGER enforce_disbursement_status_transition_trigger
  BEFORE UPDATE ON public.disbursements
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_disbursement_status_transition();

-- Re-create loan application status transition enforcement
CREATE OR REPLACE TRIGGER enforce_loan_status_transition_trigger
  BEFORE UPDATE ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_loan_application_status_transition();

-- Re-create handle new user trigger
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();