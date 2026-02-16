

# Fix Dynamic Document Requirements and Document Storage/Viewing

## Problem Summary

There are two main issues:

1. **Dynamic documents not showing for some loan products**: The Documents tab in "Add New Loan" (AdminLoans.tsx) reads `doc.document_name` to render labels, but some loan products in the database store the name under `doc_label` instead. This causes those products to show blank labels or fail to render.

2. **Documents must always be stored and viewable**: Any document uploaded anywhere in the system needs to be persisted to storage and viewable later by admins via signed URLs.

---

## Root Cause Analysis

The `required_documents` JSONB field in the `loan_products` table has **two different formats**:

- **Newer products** (Salary Advance, Business Loan, Collateral Based Loan) use: `{ document_name, is_mandatory, display_order }`
- **Older products** (Emergency Loan, Guarantor Loans, Vehicle Clearance) use: `{ doc_label, doc_type, is_mandatory, display_order, category }`

The code only reads `document_name`, so it silently fails for older-format products.

---

## Plan

### Step 1: Normalize document name reading in AdminLoans.tsx

Update the Documents tab rendering (around line 1545) to handle both JSONB formats:

- Read `doc.document_name || doc.doc_label` as the display name
- Read `doc.document_type || doc.doc_type || docKey` as the type key
- This single fix ensures all products display their documents correctly regardless of format

### Step 2: Fix document upload submission logic

Update the upload mutation (around line 478) to also use the normalized field:

- Match doc config using `d.document_name || d.doc_label` for the label
- Ensure doc_type uses the normalized key for consistent storage

### Step 3: Standardize all loan products' required_documents format in the database

Run a database migration to update the three older products (Emergency Loan, Guarantor Loans, Vehicle Clearance) to use the same `document_name` format as the newer products, ensuring consistency going forward.

### Step 4: Ensure all document uploads are stored and viewable

Verify that the upload flow in AdminLoans.tsx:
- Uploads files to the `loan-documents` private storage bucket
- Saves records to the `application_documents` table with correct metadata
- Documents can be viewed later via the ApplicationDocumentsTab component using signed URLs

Review the `ApplicationDocumentsTab` component to confirm it handles both legacy column-based documents and the newer `application_documents` table records, and that the in-app document viewer (with signed URL fetching) works for all uploaded document types.

---

## Technical Details

### Files to modify:
- `src/pages/admin/AdminLoans.tsx` -- Fix document name field reading to use `doc.document_name || doc.doc_label`

### Database migration:
- Update `required_documents` JSONB for Emergency Loan, Guarantor Loans, and Vehicle Clearance to use `document_name` format instead of `doc_label`

### No new files needed

