# Database Migration Instructions for Phindu Loans

## Critical Fixes Implemented

This document contains the SQL migration that **MUST** be run on your Supabase database to enable all the fixes we've implemented.

---

## Migration File Location

The migration file is located at:
```
/supabase/migrations/20260206_application_documents_system.sql
```

---

## How to Run the Migration

### Option 1: Using Supabase CLI (Recommended)

```bash
# Navigate to your project directory
cd /Users/Hokma/Documents/phinduloans

# Run the migration
supabase db push
```

### Option 2: Manual Execution in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to: **SQL Editor**
3. Copy the entire contents of `/supabase/migrations/20260206_application_documents_system.sql`
4. Paste into the SQL Editor
5. Click **RUN**

---

## What This Migration Does

### 1. **Creates `application_documents` Table**
- Replaces hardcoded columns (`nrc_front_url`, `nrc_back_url`, etc.)
- Stores ALL documents with full metadata
- Includes `payslip_password` field ✅
- Supports unlimited document types per application

### 2. **Migrates Existing Documents**
- Automatically copies all existing documents from `loan_applications` table
- Preserves file URLs and timestamps
- No data loss

### 3. **Creates `borrower_document_vault` Table**
- Permanent document storage for borrowers
- Allows document reuse across multiple applications
- Admin-verifiable documents

### 4. **Updates `loan_products` Table**
- Adds `required_documents` JSONB field
- Each product can now have custom document requirements
- Default requirements pre-populated for existing products

### 5. **Sets Up RLS Policies**
- Borrowers can only see their own documents
- Admins can see all documents
- Proper security controls

---

## What Needs to be Done AFTER Migration

### Frontend Changes (Already Done ✅)
- ✅ OTP error messages improved
- ✅ Real-time dashboard subscription added
- ✅ Product-specific document requirements
- ✅ Payslip password capture
- ✅ Document upload saves to `application_documents` table

### Backend Edge Functions (Already Done ✅)
- ✅ `send-otp`: Better error messages (404 for "not found")
- ✅ `verify-otp`: Clear OTP validation errors

---

## Verification Steps

After running the migration, verify:

1. **Check tables exist:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('application_documents', 'borrower_document_vault');
```

2. **Check data migrated:**
```sql
SELECT COUNT(*) as migrated_docs 
FROM application_documents;
```

3. **Check loan products updated:**
```sql
SELECT name, required_documents 
FROM loan_products 
LIMIT 1;
```

---

## Expected Results

After migration + code deployment:

✅ **Admin sees ALL documents** - No more missing docs  
✅ **Payslip passwords visible** - Admin can open protected PDFs  
✅ **Product-specific docs** - Business loans don't ask for salary docs  
✅ **OTP errors clear** - "No account found" vs "Invalid OTP" vs "Expired"  
✅ **Real-time status** - Borrower dashboard updates instantly when admin changes status  

---

## Rollback (If Needed)

If something goes wrong, you can rollback by:

1. Drop the new tables:
```sql
DROP TABLE IF EXISTS application_documents CASCADE;
DROP TABLE IF EXISTS borrower_document_vault CASCADE;
```

2. Remove the `required_documents` column:
```sql
ALTER TABLE loan_products DROP COLUMN IF EXISTS required_documents;
```

**Note:** The old `nrc_front_url`, `nrc_back_url`, etc. columns are still in `loan_applications` table, so no data is lost.

---

## Support

If you encounter any issues during migration:
1. Check Supabase logs for errors
2. Verify RLS policies are enabled
3. Ensure all referenced functions exist (`update_updated_at_column`, `has_role`)

The migration is designed to be **non-destructive** - existing data remains unchanged.
