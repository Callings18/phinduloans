

# Fix: Show ALL Borrower Documents in Admin View

## Problem

The admin Documents tab currently only reads from hardcoded columns on the `loan_applications` table (e.g., `nrc_front_url`, `selfie_url`, `payslip_url`). It does **not** query the new `application_documents` table at all.

This means:
- Documents like **bank statements**, **payslip 2 & 3**, and **employer letters** that exist in the old columns are shown, but any documents stored only in `application_documents` are invisible.
- The new `application_documents` table (which has 37 records) is completely ignored by the admin UI.
- Payslip passwords stored in `application_documents` are not displayed.

## Root Cause

Looking at the code in `AdminApplications.tsx` (lines 1709-1768), the Documents tab builds its list exclusively from the `loan_applications` columns:
```
nrc_front_url, nrc_back_url, selfie_url, payslip_url, payslip_2_url,
payslip_3_url, bank_statement_url, employer_letter_url, collateral_image_url, ...
```

It never fetches from `application_documents`, so any docs stored there are invisible to the admin.

## Solution

Update the Documents tab in `AdminApplications.tsx` to:

1. **Fetch documents from `application_documents` table** for the selected application
2. **Merge both sources** -- legacy columns from `loan_applications` AND rows from `application_documents`
3. **Deduplicate** so the same file is not shown twice
4. **Display payslip passwords** from both legacy field and `application_documents.payslip_password`
5. **Show all documents** in a clean grid with view buttons

## Technical Details

### Step 1: Add a query for `application_documents`

When the admin opens an application detail dialog, fetch all documents from the `application_documents` table for that application ID:

```typescript
const { data: appDocuments } = useQuery({
  queryKey: ['application-documents', selectedApp?.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('application_documents')
      .select('*')
      .eq('application_id', selectedApp.id)
      .order('doc_type', { ascending: true });
    if (error) throw error;
    return data;
  },
  enabled: !!selectedApp?.id,
});
```

### Step 2: Build a unified document list in the Documents tab

Combine legacy column-based documents with `application_documents` rows. Use file URL as deduplication key to avoid showing the same file twice:

```text
1. Start with all `application_documents` rows (these are the "primary" source)
2. Add any legacy column docs whose file_url is NOT already in the list
3. Display the merged list in a grid
```

### Step 3: Show payslip passwords prominently

Check for payslip password from:
- `selectedApp.payslip_password` (legacy field)
- Any `application_documents` row where `payslip_password` is not null

Display all found passwords in a warning card at the top of the Documents section.

### Step 4: Update the Documents tab JSX

Replace the current hardcoded document list (lines 1709-1768) with the merged list that shows:
- Document type icon based on `doc_type`
- Document label
- Upload source (borrower/admin)
- View button that opens a signed URL
- Download capability

### Files to Edit

- `src/pages/admin/AdminApplications.tsx` -- Add `application_documents` query and update the Documents tab rendering

No database changes needed -- the `application_documents` table and RLS policies already exist and are properly configured for admin access.
