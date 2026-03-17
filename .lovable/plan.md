

## Fix: Documents Breaking After Upload — Root Cause and Solution

### Root Cause

The document upload and matching system has a **key mismatch** between what gets saved and what gets looked up.

**During loan creation** (AdminApplications.tsx), documents are keyed and saved using a mangled version of the `document_name`:
```
docKey = doc.document_name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
```

For a product with required docs like:
| `document_type` | `document_name` | Saved `doc_type` (mangled from name) |
|---|---|---|
| `bank_statement_1` | "Month 1" | `month_1` |
| `bank_statement_2` | "Month 2" | `month_2` |
| `payslip_1` | "Latest" | `latest` |
| `proof_of_residence` | "Proof of Residence (Utility Bill)" | `proof_of_residence__utility_bill_` |

**During document review** (ApplicationDocumentsTab.tsx), the checklist compares the uploaded `doc_type` against the product's `document_type`. So it tries to match `month_1` against `bank_statement_1` — they never match. All uploaded docs fall through to "Additional Documents".

### Fix

**1. AdminApplications.tsx — Use `document_type` as the key, not mangled name**

Two locations need fixing:

- **Line 1802 (upload form)**: Change `docKey` from `doc.document_name?.replace(...)` to `doc.document_type` so the file input state uses the correct identifier.

- **Lines 373-382 (mutation)**: Change `docKey` from `doc.document_name?.replace(...)` to `doc.document_type`. Save `doc_type: doc.document_type` and `doc_label: doc.document_name` (label stays for display).

This ensures the saved `doc_type` is `bank_statement_1`, `payslip_1`, `proof_of_residence` — matching exactly what the product defines.

**2. ApplicationDocumentsTab.tsx — Strengthen label-based fallback matching**

As a safety net for documents already saved with the wrong keys, add a secondary match on `doc_label` vs `document_name` when the type-based match fails.

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/admin/AdminApplications.tsx` | Fix `docKey` to use `document_type` instead of mangled `document_name` (2 locations) |
| `src/components/admin/ApplicationDocumentsTab.tsx` | Add label-based fallback matching for already-broken docs |

This is a targeted 2-file fix that resolves the root cause permanently.

