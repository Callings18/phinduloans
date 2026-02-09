-- Phase 3.2: Commission calculations audit table
-- Stores computed commission per employee per period for audit and payroll
-- Date: 2026-02-10

CREATE TABLE IF NOT EXISTS public.commission_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  loan_ids UUID[] DEFAULT '{}',
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  formula_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_calculations_employee ON public.commission_calculations(employee_id);
CREATE INDEX IF NOT EXISTS idx_commission_calculations_period ON public.commission_calculations(period_start, period_end);

ALTER TABLE public.commission_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage commission_calculations"
  ON public.commission_calculations FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role) OR
    public.has_role(auth.uid(), 'admin'::app_role)
  );

COMMENT ON TABLE public.commission_calculations IS 'Audit of commission computed per employee per period; formula_used describes calculation (e.g. % of interest on loans processed)';
