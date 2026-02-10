-- Add awaiting_disbursement to the loan_status enum
ALTER TYPE loan_status ADD VALUE IF NOT EXISTS 'awaiting_disbursement' AFTER 'contract_signing';