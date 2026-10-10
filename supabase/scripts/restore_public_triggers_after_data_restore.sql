-- Run after successful public data restore on seobil.

DROP TRIGGER IF EXISTS trg_block_duplicate_active_loan ON public.loan_applications;
CREATE TRIGGER trg_block_duplicate_active_loan
  BEFORE INSERT ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.block_duplicate_active_loan();

DROP TRIGGER IF EXISTS validate_disbursement_balance ON public.disbursements;
CREATE TRIGGER validate_disbursement_balance
  BEFORE INSERT ON public.disbursements
  FOR EACH ROW
  EXECUTE FUNCTION public.check_account_balance_before_disbursement();
