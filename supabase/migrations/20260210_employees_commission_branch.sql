-- Phase 3.1: Add commission_percentage and branch to employees for payroll/commission linking
-- Date: 2026-02-10

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS branch TEXT;

COMMENT ON COLUMN public.employees.commission_percentage IS 'Commission % on loans processed by this employee (e.g. interest earned or disbursed amount)';
COMMENT ON COLUMN public.employees.branch IS 'Branch or location for reporting and filtering';
