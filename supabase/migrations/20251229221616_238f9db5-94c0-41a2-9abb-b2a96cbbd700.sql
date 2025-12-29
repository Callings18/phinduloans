-- Add new document and collateral columns for enhanced loan applications
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS collateral_image_url TEXT;
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS bank_statement_url TEXT;
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS payslip_2_url TEXT;
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS payslip_3_url TEXT;