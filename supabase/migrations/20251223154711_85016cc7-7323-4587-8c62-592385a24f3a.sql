-- Add new roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'loan_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'credit_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'collections_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';