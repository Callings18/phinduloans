-- 1. Create collection_activities table for tracking collection efforts
CREATE TABLE IF NOT EXISTS public.collection_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  repayment_id UUID REFERENCES public.loan_repayments(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES auth.users(id),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('phone_call', 'sms', 'email', 'site_visit', 'demand_letter', 'legal_notice')),
  notes TEXT,
  outcome TEXT CHECK (outcome IN ('promised_to_pay', 'no_answer', 'wrong_number', 'refused', 'partial_payment', 'dispute', 'other')),
  promise_date DATE,
  promise_amount NUMERIC,
  follow_up_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on collection_activities
ALTER TABLE public.collection_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for collection_activities
CREATE POLICY "Staff can view collection activities" 
  ON public.collection_activities FOR SELECT 
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'collections_officer') OR
    public.has_role(auth.uid(), 'loan_officer')
  );

CREATE POLICY "Staff can insert collection activities" 
  ON public.collection_activities FOR INSERT 
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'collections_officer') OR
    public.has_role(auth.uid(), 'loan_officer')
  );

CREATE POLICY "Staff can update collection activities" 
  ON public.collection_activities FOR UPDATE 
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'collections_officer')
  );

-- 2. Add advanced columns to loan_products
ALTER TABLE public.loan_products 
  ADD COLUMN IF NOT EXISTS interest_type TEXT DEFAULT 'flat' CHECK (interest_type IN ('flat', 'reducing_balance', 'compound')),
  ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_payment_penalty_percent NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_repayment_allowed BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS early_repayment_fee_percent NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_percent NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collateral_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_dti_ratio NUMERIC DEFAULT 50,
  ADD COLUMN IF NOT EXISTS min_credit_score INTEGER DEFAULT 0;

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_collection_activities_loan_id ON public.collection_activities(loan_id);
CREATE INDEX IF NOT EXISTS idx_collection_activities_follow_up ON public.collection_activities(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_status ON public.loan_repayments(status);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_due_date ON public.loan_repayments(due_date);

-- 4. Fix the generate_repayment_schedule trigger to reference correct table
CREATE OR REPLACE FUNCTION public.generate_repayment_schedule()
RETURNS TRIGGER AS $$
DECLARE
  loan_record RECORD;
  monthly_payment NUMERIC;
  due_date DATE;
  i INTEGER;
BEGIN
  -- Only run when status changes to 'completed' (disbursement completed)
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get loan details
    SELECT * INTO loan_record FROM public.loan_applications WHERE id = NEW.loan_id;
    
    IF loan_record IS NOT NULL THEN
      -- Calculate monthly payment
      monthly_payment := loan_record.monthly_payment;
      IF monthly_payment IS NULL OR monthly_payment = 0 THEN
        monthly_payment := loan_record.total_repayment / loan_record.loan_term_months;
      END IF;
      
      -- Generate repayment schedule
      FOR i IN 1..loan_record.loan_term_months LOOP
        due_date := (CURRENT_DATE + (i * INTERVAL '1 month'))::DATE;
        
        INSERT INTO public.loan_repayments (
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
      UPDATE public.loan_applications 
      SET status = 'active' 
      WHERE id = NEW.loan_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Ensure the trigger exists on disbursements table
DROP TRIGGER IF EXISTS trigger_generate_repayment_schedule ON public.disbursements;
CREATE TRIGGER trigger_generate_repayment_schedule
  AFTER UPDATE ON public.disbursements
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_repayment_schedule();