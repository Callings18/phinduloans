# SQL Data Migrations — Phindu Loans Plan Implementation (2026-01-22)

Run these in order. The migration file **`supabase/migrations/20260122_unified_application_documents.sql`** already contains all of the following; this document is a summary for reference.

---

## 1. Extend `loan_application_documents`

Add columns for the unified document model and admin visibility:

- `borrower_id` — UUID, references `auth.users(id)`, for vault linkage
- `doc_label` — TEXT, human-readable label
- `month_tag` — TEXT, for payslips (e.g. `YYYY-MM`)
- `payslip_password` — TEXT, nullable; admin-only visible for payslip PDFs
- `uploaded_by` — TEXT, default `'borrower'`
- `mime_type` — TEXT (e.g. `application/pdf`, `image/jpeg`)
- `file_name` — TEXT, original file name

Make `file_url` nullable (for draft/placeholder rows). Add indexes:

- `idx_loan_application_documents_borrower` on `borrower_id`
- `idx_loan_application_documents_type` on `(loan_application_id, document_type)`

Update RLS so staff roles (`admin`, `super_admin`, `loan_officer`, `credit_officer`, `finance_officer`, `auditor`) can manage all `loan_application_documents`.

---

## 2. `email_logs` table (Email Log)

- `id` — UUID, primary key
- `recipient` — TEXT, not null
- `subject` — TEXT, nullable
- `status` — TEXT, not null, default `'pending'` (e.g. `sent`, `failed`)
- `error_message` — TEXT, nullable
- `reference_type` — TEXT, nullable
- `reference_id` — UUID, nullable
- `created_at` — TIMESTAMPTZ, default `now()`

Indexes: `created_at DESC`, `recipient`. RLS: admins can SELECT; allow INSERT for the service.

---

## 3. `borrower_documents` table (Document Vault)

- `id` — UUID, primary key
- `user_id` — UUID, not null, references `auth.users(id)` ON DELETE CASCADE
- `document_type` — TEXT, not null
- `document_name` — TEXT, not null
- `file_url` — TEXT, not null
- `file_size_bytes` — INTEGER, nullable
- `mime_type` — TEXT, nullable
- `uploaded_at` — TIMESTAMPTZ, default `now()`
- UNIQUE(`user_id`, `document_type`)

Index: `user_id`. RLS: users can manage their own rows; admins can SELECT.

---

## Applying the migration

From the project root:

```bash
npx supabase db push
```

Or run the contents of **`supabase/migrations/20260122_unified_application_documents.sql`** in the Supabase SQL Editor.

No data backfill is required; new columns are nullable or have defaults, and new tables start empty.
