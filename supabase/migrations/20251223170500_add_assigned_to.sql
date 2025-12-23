-- Add assigned_to column to loan_applications for staff assignment
ALTER TABLE public.loan_applications 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- Add policy or update existing policies to allow assigned staff to view/update
-- (Existing admin policies already cover viewing/updating everything, but this column helps in filtering)

-- Create an index to speed up filtering by assigned staff
CREATE INDEX IF NOT EXISTS idx_loan_applications_assigned_to ON public.loan_applications(assigned_to);
