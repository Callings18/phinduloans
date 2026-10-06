-- Create Collections Activity Tracking
CREATE TABLE IF NOT EXISTS public.collection_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  repayment_id UUID REFERENCES public.loan_repayments(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES auth.users(id),
  activity_type TEXT NOT NULL, -- 'phone_call', 'sms', 'email', 'site_visit', 'demand_letter'
  notes TEXT,
  outcome TEXT, -- 'promised_to_pay', 'requested_extension', 'unreachable', 'disputed'
  promise_date DATE,
  follow_up_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.collection_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Collections Officers and Admins can manage collection activities" ON public.collection_activities;
DROP POLICY IF EXISTS "Collections Officers and Admins can manage collection activities" ON public.collection_activities;
DROP POLICY IF EXISTS "Collections Officers and Admins can manage collection activities" ON public.collection_activities;
CREATE POLICY "Collections Officers and Admins can manage collection activities"
  ON public.collection_activities FOR ALL
  USING (
    public.has_role(auth.uid(), 'collections_officer') OR 
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "Relevant staff can view collection activities" ON public.collection_activities;
CREATE POLICY "Relevant staff can view collection activities"
  ON public.collection_activities FOR SELECT
  USING (
    public.has_role(auth.uid(), 'loan_officer') OR 
    public.has_role(auth.uid(), 'auditor')
  );

-- Add Index for performance
CREATE INDEX IF NOT EXISTS idx_collection_activities_loan_id ON public.collection_activities(loan_id);
