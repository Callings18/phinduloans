-- Add escalation and assignment columns to collection_activities
ALTER TABLE public.collection_activities
ADD COLUMN IF NOT EXISTS escalation_level integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS assigned_to uuid,
ADD COLUMN IF NOT EXISTS ptp_status text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contact_method text;

-- Create collection assignments table for tracking collector workload
CREATE TABLE IF NOT EXISTS public.collection_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  collector_id uuid NOT NULL,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_by uuid,
  status text DEFAULT 'active',
  priority text DEFAULT 'normal',
  notes text,
  last_contact_at timestamp with time zone,
  next_action_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(loan_id, collector_id, status)
);

-- Enable RLS
ALTER TABLE public.collection_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for collection_assignments
DROP POLICY IF EXISTS "Staff can view collection assignments" ON public.collection_assignments;
CREATE POLICY "Staff can view collection assignments"
ON public.collection_assignments
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'collections_officer') OR 
  has_role(auth.uid(), 'loan_officer') OR
  collector_id = auth.uid()
);

DROP POLICY IF EXISTS "Staff can insert collection assignments" ON public.collection_assignments;
CREATE POLICY "Staff can insert collection assignments"
ON public.collection_assignments
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'collections_officer')
);

DROP POLICY IF EXISTS "Staff can update collection assignments" ON public.collection_assignments;
CREATE POLICY "Staff can update collection assignments"
ON public.collection_assignments
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'collections_officer') OR
  collector_id = auth.uid()
);

DROP POLICY IF EXISTS "Admins can delete collection assignments" ON public.collection_assignments;
CREATE POLICY "Admins can delete collection assignments"
ON public.collection_assignments
FOR DELETE
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin')
);

-- Create demand letters tracking table
CREATE TABLE IF NOT EXISTS public.demand_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  letter_type text NOT NULL DEFAULT 'first_notice',
  generated_by uuid,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_at timestamp with time zone,
  sent_via text,
  delivery_status text DEFAULT 'pending',
  file_url text,
  amount_demanded numeric,
  due_date date,
  response_received boolean DEFAULT false,
  response_date date,
  response_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demand_letters ENABLE ROW LEVEL SECURITY;

-- RLS policies for demand_letters
DROP POLICY IF EXISTS "Staff can view demand letters" ON public.demand_letters;
CREATE POLICY "Staff can view demand letters"
ON public.demand_letters
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'collections_officer') OR 
  has_role(auth.uid(), 'loan_officer')
);

DROP POLICY IF EXISTS "Staff can insert demand letters" ON public.demand_letters;
CREATE POLICY "Staff can insert demand letters"
ON public.demand_letters
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'collections_officer')
);

DROP POLICY IF EXISTS "Staff can update demand letters" ON public.demand_letters;
CREATE POLICY "Staff can update demand letters"
ON public.demand_letters
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'collections_officer')
);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_collection_assignments_updated_at ON public.collection_assignments;
CREATE TRIGGER update_collection_assignments_updated_at
BEFORE UPDATE ON public.collection_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create view for overdue loans with collection info
CREATE OR REPLACE VIEW public.overdue_loans_view AS
SELECT 
  la.id as loan_id,
  la.full_name as borrower_name,
  la.phone as borrower_phone,
  la.email as borrower_email,
  la.loan_amount,
  la.total_repayment,
  la.status as loan_status,
  COALESCE(
    (SELECT SUM(amount) FROM public.loan_repayments WHERE loan_id = la.id AND status = 'paid'),
    0
  ) as total_paid,
  COALESCE(
    (SELECT COUNT(*) FROM public.loan_repayments 
     WHERE loan_id = la.id AND status = 'pending' AND due_date < CURRENT_DATE),
    0
  ) as overdue_count,
  COALESCE(
    (SELECT SUM(amount + COALESCE(penalty_amount, 0)) FROM public.loan_repayments 
     WHERE loan_id = la.id AND status = 'pending' AND due_date < CURRENT_DATE),
    0
  ) as overdue_amount,
  COALESCE(
    (SELECT MIN(due_date) FROM public.loan_repayments 
     WHERE loan_id = la.id AND status = 'pending' AND due_date < CURRENT_DATE),
    NULL
  ) as oldest_overdue_date,
  ca.collector_id as assigned_collector_id,
  ca.priority as collection_priority,
  ca.last_contact_at,
  ca.next_action_date,
  (SELECT activity_type FROM public.collection_activities 
   WHERE loan_id = la.id ORDER BY created_at DESC LIMIT 1) as last_activity_type,
  (SELECT created_at FROM public.collection_activities 
   WHERE loan_id = la.id ORDER BY created_at DESC LIMIT 1) as last_activity_date,
  (SELECT promise_date FROM public.collection_activities 
   WHERE loan_id = la.id AND promise_date IS NOT NULL AND promise_date >= CURRENT_DATE
   ORDER BY created_at DESC LIMIT 1) as active_ptp_date,
  (SELECT promise_amount FROM public.collection_activities 
   WHERE loan_id = la.id AND promise_date IS NOT NULL AND promise_date >= CURRENT_DATE
   ORDER BY created_at DESC LIMIT 1) as active_ptp_amount
FROM public.loan_applications la
LEFT JOIN public.collection_assignments ca ON ca.loan_id = la.id AND ca.status = 'active'
WHERE la.status IN ('active', 'disbursed')
AND EXISTS (
  SELECT 1 FROM public.loan_repayments 
  WHERE loan_id = la.id AND status = 'pending' AND due_date < CURRENT_DATE
);