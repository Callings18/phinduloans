-- Add installment_number column to loan_repayments table
ALTER TABLE public.loan_repayments 
ADD COLUMN IF NOT EXISTS installment_number integer;

-- Add active status to loan_status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'active' AND enumtypid = 'public.loan_status'::regtype) THEN
    ALTER TYPE public.loan_status ADD VALUE 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'completed' AND enumtypid = 'public.loan_status'::regtype) THEN
    ALTER TYPE public.loan_status ADD VALUE 'completed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'defaulted' AND enumtypid = 'public.loan_status'::regtype) THEN
    ALTER TYPE public.loan_status ADD VALUE 'defaulted';
  END IF;
END$$;

-- Create function to generate repayment schedule when disbursement is completed
CREATE OR REPLACE FUNCTION public.generate_repayment_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  loan_record RECORD;
  monthly_payment NUMERIC;
  due_date DATE;
  i INTEGER;
BEGIN
  -- Only run when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get loan details
    SELECT * INTO loan_record FROM loan_applications WHERE id = NEW.loan_id;
    
    IF loan_record IS NOT NULL THEN
      -- Calculate monthly payment
      monthly_payment := loan_record.monthly_payment;
      IF monthly_payment IS NULL OR monthly_payment = 0 THEN
        monthly_payment := loan_record.total_repayment / loan_record.loan_term_months;
      END IF;
      
      -- Generate repayment schedule
      FOR i IN 1..loan_record.loan_term_months LOOP
        due_date := (CURRENT_DATE + (i * INTERVAL '1 month'))::DATE;
        
        INSERT INTO loan_repayments (
          loan_id,
          user_id,
          amount,
          due_date,
          status,
          installment_number
        ) VALUES (
          NEW.loan_id,
          loan_record.user_id,
          monthly_payment,
          due_date,
          'pending',
          i
        );
      END LOOP;
      
      -- Update loan status to active
      UPDATE loan_applications 
      SET status = 'active' 
      WHERE id = NEW.loan_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-generating repayment schedule
DROP TRIGGER IF EXISTS trigger_generate_repayment_schedule ON public.disbursements;
CREATE TRIGGER trigger_generate_repayment_schedule
AFTER UPDATE ON public.disbursements
FOR EACH ROW
EXECUTE FUNCTION public.generate_repayment_schedule();