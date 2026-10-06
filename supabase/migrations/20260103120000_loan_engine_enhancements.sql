-- =====================================================
-- LOAN ENGINE ENHANCEMENT - DATABASE MIGRATIONS
-- Run these in your Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PHASE 2: PER-PRODUCT DOCUMENT MANAGEMENT
-- =====================================================

-- Table: loan_product_documents
-- Defines required documents for each loan product
CREATE TABLE IF NOT EXISTS loan_product_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_product_id UUID NOT NULL REFERENCES loan_products(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  description TEXT,
  is_mandatory BOOLEAN DEFAULT true,
  allowed_file_types TEXT[] DEFAULT ARRAY['pdf', 'jpg', 'jpeg', 'png'],
  max_file_size_mb INTEGER DEFAULT 5,
  validity_days INTEGER, -- NULL = no expiry
  can_reuse_previous BOOLEAN DEFAULT false, -- Reuse from previous loans
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add category column to loan_products if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'loan_products' AND column_name = 'category') THEN
    ALTER TABLE loan_products ADD COLUMN category TEXT DEFAULT 'personal';
  END IF;
END $$;

-- Add term_unit column to loan_products if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'loan_products' AND column_name = 'term_unit') THEN
    ALTER TABLE loan_products ADD COLUMN term_unit TEXT DEFAULT 'months';
  END IF;
END $$;

-- Table: loan_application_documents 
-- Stores uploaded documents for each loan application
CREATE TABLE IF NOT EXISTS loan_application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  document_config_id UUID REFERENCES loan_product_documents(id),
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  file_type TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  review_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Based on validity_days
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PHASE 3: CONFIGURABLE APPROVAL WORKFLOW
-- =====================================================

-- Table: workflow_stages
-- Defines the stages in an approval workflow
CREATE TABLE IF NOT EXISTS workflow_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_product_id UUID REFERENCES loan_products(id) ON DELETE CASCADE,
  stage_code TEXT NOT NULL, -- e.g., 'submitted', 'document_review', 'crb_check'
  stage_name TEXT NOT NULL,
  stage_description TEXT,
  stage_order INTEGER NOT NULL DEFAULT 0,
  stage_type TEXT DEFAULT 'manual', -- manual, automatic, conditional
  color TEXT DEFAULT '#3b82f6', -- For UI display
  icon TEXT, -- lucide icon name
  is_initial BOOLEAN DEFAULT false, -- First stage
  is_terminal BOOLEAN DEFAULT false, -- Final stage (approved, rejected, etc.)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(loan_product_id, stage_code)
);

-- Table: workflow_transitions
-- Defines allowed transitions between stages
CREATE TABLE IF NOT EXISTS workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_product_id UUID REFERENCES loan_products(id) ON DELETE CASCADE,
  from_stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
  to_stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
  transition_name TEXT NOT NULL, -- e.g., 'Approve', 'Reject', 'Request More Docs'
  transition_action TEXT, -- approve, reject, escalate, return
  required_role TEXT[], -- Roles that can perform this transition
  requires_comment BOOLEAN DEFAULT false,
  requires_document BOOLEAN DEFAULT false,
  auto_trigger_condition JSONB, -- For automatic transitions
  notification_template TEXT, -- Email/SMS template to send
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: workflow_stage_permissions
-- Role-based permissions for each stage
CREATE TABLE IF NOT EXISTS workflow_stage_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- admin, loan_officer, collections, etc.
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  can_transition BOOLEAN DEFAULT false,
  can_comment BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: workflow_history
-- Audit trail of all stage transitions
CREATE TABLE IF NOT EXISTS workflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  transition_action TEXT,
  performed_by UUID REFERENCES auth.users(id),
  performed_by_name TEXT,
  comment TEXT,
  metadata JSONB, -- Additional data about the transition
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- DEFAULT WORKFLOW TEMPLATES
-- =====================================================

-- Function to create default workflow for a loan product
CREATE OR REPLACE FUNCTION create_default_workflow(p_product_id UUID)
RETURNS VOID AS $$
DECLARE
  v_stage_ids UUID[];
BEGIN
  -- Create default stages
  INSERT INTO workflow_stages (loan_product_id, stage_code, stage_name, stage_description, stage_order, stage_type, color, icon, is_initial, is_terminal)
  VALUES
    (p_product_id, 'draft', 'Draft', 'Application started but not submitted', 0, 'manual', '#6b7280', 'FileEdit', true, false),
    (p_product_id, 'submitted', 'Submitted', 'Application submitted for review', 1, 'manual', '#3b82f6', 'Send', false, false),
    (p_product_id, 'document_review', 'Document Review', 'Verifying uploaded documents', 2, 'manual', '#8b5cf6', 'FileSearch', false, false),
    (p_product_id, 'crb_check', 'CRB Check', 'Credit bureau verification', 3, 'automatic', '#f59e0b', 'Shield', false, false),
    (p_product_id, 'under_review', 'Under Review', 'Loan officer reviewing application', 4, 'manual', '#06b6d4', 'Eye', false, false),
    (p_product_id, 'approved', 'Approved', 'Loan approved, pending disbursement', 5, 'manual', '#10b981', 'CheckCircle', false, false),
    (p_product_id, 'disbursed', 'Disbursed', 'Funds sent to borrower', 6, 'manual', '#22c55e', 'Banknote', false, false),
    (p_product_id, 'active', 'Active', 'Loan is active with ongoing repayments', 7, 'automatic', '#14b8a6', 'Activity', false, false),
    (p_product_id, 'completed', 'Completed', 'Loan fully repaid', 8, 'automatic', '#10b981', 'Trophy', false, true),
    (p_product_id, 'rejected', 'Rejected', 'Application rejected', 99, 'manual', '#ef4444', 'XCircle', false, true),
    (p_product_id, 'defaulted', 'Defaulted', 'Loan in default status', 100, 'automatic', '#dc2626', 'AlertTriangle', false, true)
  RETURNING id INTO v_stage_ids;
  
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_loan_product_documents_product ON loan_product_documents(loan_product_id);
CREATE INDEX IF NOT EXISTS idx_loan_application_documents_app ON loan_application_documents(loan_application_id);
CREATE INDEX IF NOT EXISTS idx_workflow_stages_product ON workflow_stages(loan_product_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_product ON workflow_transitions(loan_product_id);
CREATE INDEX IF NOT EXISTS idx_workflow_history_app ON workflow_history(loan_application_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

ALTER TABLE loan_product_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_history ENABLE ROW LEVEL SECURITY;

-- Policy: loan_product_documents - Admins can manage, all authenticated can view
CREATE POLICY "Admins can manage loan_product_documents" ON loan_product_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "Authenticated users can view loan_product_documents" ON loan_product_documents
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: loan_application_documents - Users can manage their own, admins can manage all
CREATE POLICY "Users can manage own loan_application_documents" ON loan_application_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM loan_applications WHERE id = loan_application_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all loan_application_documents" ON loan_application_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'loan_officer'))
  );

-- Policy: workflow tables - Admins can manage
CREATE POLICY "Admins can manage workflow_stages" ON workflow_stages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "Authenticated can view workflow_stages" ON workflow_stages
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage workflow_transitions" ON workflow_transitions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "Authenticated can view workflow_transitions" ON workflow_transitions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can view all workflow_history" ON workflow_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'loan_officer'))
  );

CREATE POLICY "Users can view own workflow_history" ON workflow_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM loan_applications WHERE id = loan_application_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins can insert workflow_history" ON workflow_history
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'loan_officer'))
  );

-- =====================================================
-- SAMPLE DATA: Default document types
-- =====================================================

-- Insert common document types for reference
INSERT INTO loan_product_documents (loan_product_id, document_type, document_name, description, is_mandatory, allowed_file_types, max_file_size_mb, display_order)
SELECT 
  lp.id,
  dt.document_type,
  dt.document_name,
  dt.description,
  dt.is_mandatory,
  dt.allowed_file_types,
  dt.max_file_size_mb,
  dt.display_order
FROM loan_products lp
CROSS JOIN (
  VALUES
    ('nrc_front', 'NRC (Front)', 'National Registration Card - Front side', true, ARRAY['jpg', 'jpeg', 'png', 'pdf'], 5, 1),
    ('nrc_back', 'NRC (Back)', 'National Registration Card - Back side', true, ARRAY['jpg', 'jpeg', 'png', 'pdf'], 5, 2),
    ('payslip', 'Latest Payslip', 'Most recent payslip from employer', true, ARRAY['pdf', 'jpg', 'jpeg', 'png'], 5, 3),
    ('bank_statement', 'Bank Statement', '3 months bank statement', true, ARRAY['pdf'], 10, 4),
    ('employment_letter', 'Employment Letter', 'Letter confirming employment', false, ARRAY['pdf', 'jpg', 'jpeg', 'png'], 5, 5),
    ('proof_of_residence', 'Proof of Residence', 'Utility bill or rental agreement', false, ARRAY['pdf', 'jpg', 'jpeg', 'png'], 5, 6)
) AS dt(document_type, document_name, description, is_mandatory, allowed_file_types, max_file_size_mb, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM loan_product_documents lpd 
  WHERE lpd.loan_product_id = lp.id AND lpd.document_type = dt.document_type
)
AND lp.is_active = true
LIMIT 50; -- Safety limit

-- =====================================================
-- END OF MIGRATIONS
-- =====================================================
