ALTER TABLE loan_applications
ADD COLUMN IF NOT EXISTS contract_fully_signed_at timestamptz;

COMMENT ON COLUMN loan_applications.contract_fully_signed_at IS 'Set when both borrower and admin have signed; optional audit field.';