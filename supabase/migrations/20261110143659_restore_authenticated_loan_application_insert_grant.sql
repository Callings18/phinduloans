-- Restore the missing table privilege needed to create staff loan applications.
-- RLS remains enabled and existing INSERT policies continue to decide which rows
-- authenticated users may create.
GRANT INSERT ON TABLE public.loan_applications TO authenticated;
