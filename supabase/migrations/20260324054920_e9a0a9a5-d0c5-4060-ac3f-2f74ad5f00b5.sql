
CREATE OR REPLACE FUNCTION public.cancel_repayments_on_loan_closure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('rejected', 'defaulted', 'completed') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('rejected', 'defaulted', 'completed')) THEN
    
    UPDATE public.loan_repayments
    SET status = 'cancelled'
    WHERE loan_id = NEW.id
    AND status IN ('pending', 'overdue');
    
    UPDATE public.notification_logs
    SET status = 'cancelled'
    WHERE user_id = NEW.user_id
    AND status = 'pending'
    AND title IN ('Overdue Payment Reminder', 'Payment Due Reminder', 'Payment Due Soon');
    
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_repayments_on_closure ON public.loan_applications;
CREATE TRIGGER trg_cancel_repayments_on_closure
  AFTER UPDATE ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_repayments_on_loan_closure();

UPDATE public.loan_repayments
SET status = 'cancelled'
WHERE loan_id IN (
  SELECT id FROM public.loan_applications 
  WHERE status IN ('rejected', 'defaulted')
)
AND status IN ('pending', 'overdue');

UPDATE public.notification_logs
SET status = 'cancelled'
WHERE user_id IN (
  SELECT user_id FROM public.loan_applications 
  WHERE status IN ('rejected', 'defaulted')
)
AND status = 'pending'
AND title IN ('Overdue Payment Reminder', 'Payment Due Reminder', 'Payment Due Soon');
