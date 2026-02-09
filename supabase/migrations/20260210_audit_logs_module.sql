-- Add optional module column to audit_logs for RBAC/reporting
-- Date: 2026-02-10

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS module TEXT;

COMMENT ON COLUMN public.audit_logs.module IS 'Module/category for the action (e.g. loans, disbursement, products). Can mirror entity_type.';
