-- Fix Business Loan required_documents: add proper document_type values
UPDATE public.loan_products
SET required_documents = '[
  {"document_type": "nrc_front", "document_name": "NRC Front", "is_mandatory": true, "display_order": 1},
  {"document_type": "nrc_back", "document_name": "NRC Back", "is_mandatory": true, "display_order": 2},
  {"document_type": "selfie_holding_nrc", "document_name": "Selfie Holding NRC", "is_mandatory": true, "display_order": 3},
  {"document_type": "certificate_of_incorporation", "document_name": "Certificate of Incorporation", "is_mandatory": true, "display_order": 4},
  {"document_type": "shareholders_details", "document_name": "Shareholders Details", "is_mandatory": true, "display_order": 5},
  {"document_type": "proof_of_business", "document_name": "Proof of Place of Business", "is_mandatory": true, "display_order": 6},
  {"document_type": "financial_statement", "document_name": "Financial Statement", "is_mandatory": true, "display_order": 7}
]'::jsonb
WHERE name = 'Business Loan';

-- Fix Collateral Based Loan required_documents
UPDATE public.loan_products
SET required_documents = '[
  {"document_type": "nrc_front", "document_name": "NRC Front", "is_mandatory": true, "display_order": 1},
  {"document_type": "nrc_back", "document_name": "NRC Back", "is_mandatory": true, "display_order": 2},
  {"document_type": "selfie_holding_nrc", "document_name": "Selfie Holding NRC", "is_mandatory": true, "display_order": 3},
  {"document_type": "collateral_full_details", "document_name": "Collateral Full Details", "is_mandatory": true, "display_order": 4},
  {"document_type": "collateral_pictures", "document_name": "Collateral Pictures", "is_mandatory": true, "display_order": 5},
  {"document_type": "collateral_value_estimate", "document_name": "Estimated Value of Collateral", "is_mandatory": true, "display_order": 6},
  {"document_type": "proof_of_residence", "document_name": "Proof of Residence", "is_mandatory": true, "display_order": 7}
]'::jsonb
WHERE name = 'Collateral Based Loan';

-- Fix Salary Advance Loan required_documents
UPDATE public.loan_products
SET required_documents = '[
  {"document_type": "nrc_front", "document_name": "NRC Front", "is_mandatory": true, "display_order": 1},
  {"document_type": "nrc_back", "document_name": "NRC Back", "is_mandatory": true, "display_order": 2},
  {"document_type": "selfie_holding_nrc", "document_name": "Selfie Holding NRC", "is_mandatory": true, "display_order": 3},
  {"document_type": "bank_statement_1", "document_name": "Bank Statement - Month 1", "is_mandatory": true, "display_order": 4},
  {"document_type": "bank_statement_2", "document_name": "Bank Statement - Month 2", "is_mandatory": true, "display_order": 5},
  {"document_type": "bank_statement_3", "document_name": "Bank Statement - Month 3", "is_mandatory": true, "display_order": 6},
  {"document_type": "payslip_1", "document_name": "Payslip 1 (Latest)", "is_mandatory": true, "display_order": 7},
  {"document_type": "payslip_2", "document_name": "Payslip 2", "is_mandatory": true, "display_order": 8},
  {"document_type": "payslip_3", "document_name": "Payslip 3", "is_mandatory": true, "display_order": 9},
  {"document_type": "proof_of_residence", "document_name": "Proof of Residence (Utility Bill)", "is_mandatory": true, "display_order": 10}
]'::jsonb
WHERE name = 'Salary Advance Loan';