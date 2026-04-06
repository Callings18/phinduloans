# Supabase usage audit & migration order

This document maps direct `@/integrations/supabase/client` usage by domain and recommends a **strangler** cutover order: **read-only/low-risk first**, then **writes**, then **auth/storage/RPC**.

## Migration phases (recommended)

| Phase | Domain | Risk | Notes |
|-------|--------|------|--------|
| **1** | Loan products (public reads) | Low | Calculator, comparison, quick apply — first API slice |
| **2** | System settings / PMIC (reads) | Low | `useSystemSettings`, `usePMIC`, hooks |
| **3** | Profiles & KYC reads | Medium | Dashboard tabs, document vault |
| **4** | Loan applications (CRUD) | High | Core workflow; includes storage |
| **5** | Repayments, accounts, transactions | High | Financial integrity |
| **6** | Admin: collections, disbursements, expenses | High | Side effects + audit |
| **7** | HR / payroll / employees | High | Many legacy `(supabase.from as any)` calls |
| **8** | Auth + `user_roles` | High | Replace Supabase Auth with JWT/session in Nest |
| **9** | Storage (`loan-documents`) | Medium–High | Move to S3-compatible or Nest-signed URLs |
| **10** | Edge functions & RPC | High | `supabase.functions.invoke`, `supabase.rpc(...)` |

## Files by domain

### Authentication & roles
- `src/hooks/useAuth.tsx` — `auth.*`, `user_roles`, `profiles`, RPC `log_auth_event`
- `src/hooks/usePermissions.ts`
- `src/components/admin/AdminRoute.tsx`
- `src/pages/Auth.tsx`, `src/components/auth/PhoneAuthForm.tsx`

### Loan products (reads + admin writes)
- `src/components/home/LoanCalculator.tsx`
- `src/pages/Calculator.tsx`
- `src/components/common/LoanComparison.tsx`
- `src/components/dashboard/QuickApply.tsx`
- `src/pages/admin/AdminLoanProducts.tsx`
- `src/pages/admin/AdminReports.tsx` (product filter)
- `src/components/admin/LoanDetailsModal.tsx`
- Multiple admin pages (joins on `loan_products`)

### Loan applications & documents
- `src/components/dashboard/LoanApplicationForm.tsx`
- `src/pages/admin/AdminApplications.tsx`
- `src/pages/Dashboard.tsx`, `src/components/dashboard/*` (status, KYC, contracts)
- Storage: `supabase.storage.from("loan-documents")`

### Loans & repayments
- `src/pages/admin/AdminLoans.tsx`
- `src/pages/admin/AdminRepayments.tsx`
- `src/pages/admin/AdminBulkRepayments.tsx`
- `src/components/admin/LoanDetailsModal.tsx` — RPC `apply_loan_penalties`, `calculate_early_settlement`

### Finance & accounts
- `src/pages/admin/AdminAccounts.tsx`, `AdminWallets.tsx`, `AdminExpenses.tsx`, `AdminDisbursements.tsx`

### Collections & legal
- `src/pages/admin/AdminCollections.tsx`, `AdminWriteOffs.tsx`, `AdminCourtCases.tsx`

### HR & payroll
- `src/pages/admin/AdminHR.tsx`, `AdminPayroll.tsx`
- `src/utils/payrollCalculations.ts` (if DB-tied)

### Settings & integrations
- `src/pages/admin/AdminSettings.tsx`
- `src/hooks/useSystemSettings.ts`
- `src/components/admin/IntegrationsSettings.tsx`, `BrevoSettings.tsx`, `NotificationProvidersSettings.tsx`

### Reporting
- `src/components/admin/reports/*.tsx`, `src/pages/admin/AdminReports.tsx`, `AdminDashboard.tsx`

### Utilities (Supabase side effects)
- `src/utils/auditLog.ts`, `src/utils/notificationService.ts`, `src/utils/sendDirectNotification.ts`, `src/utils/storageHelpers.ts`

## Realtime channels

Several components subscribe to `postgres_changes` on `loan_products` (and others). When a domain moves to the REST API, **disable Supabase channels** for that table and rely on polling or future WebSocket from Nest.

## Feature flags

Use `VITE_API_*` env flags per domain (see [`src/config/apiMode.ts`](../src/config/apiMode.ts)). First implemented: **`VITE_API_LOAN_PRODUCTS`** (set `true` + `VITE_API_URL` to use [`GET /api/v1/loan-products`](../docs/API_CONTRACTS.md)).

## Implemented slices

| Domain | Frontend | Backend |
|--------|----------|---------|
| Loan products (read) | `loanProductsRepository`, Calculator / LoanCalculator / LoanComparison / QuickApply | `GET /api/v1/loan-products` |
