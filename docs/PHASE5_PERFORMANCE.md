# Phase 5 Performance & Cleanup

## Scope delivered
- Added route-level lazy loading in `apps/staff-web/src/App.tsx` for heavy admin areas:
  - Reports
  - Accounts
  - HR
  - Payroll
  - Payroll tax config
  - AI Agents + detail
  - AI Ops Center
  - Product houses shell and house sub-pages (dashboard, borrowers, loans, review, disbursements, collections, reports, reconciliation)
- Used `React.lazy` + `Suspense` with the existing admin spinner pattern to keep loading UX consistent.
- Updated `vitest.config.ts` to include `packages/**/__tests__/**/*.{test,spec}.{ts,tsx}` so shared package tests run from root `npm run test`.

## Cleanup notes
- Legacy per-product create-loan routes were checked in `App.tsx`; active loan creation now routes through house pages (`/admin/houses/:productCode/loans/create`).
- No mass deletion was performed to avoid risk where shared components may still be imported dynamically or from in-progress branches.

## Bundle/runtime notes
- Route chunking now defers large admin screens until visited, reducing initial office shell load cost.
- Suspense fallback is route-scoped and does not alter auth or RBAC guards.
- Before/after byte metrics were not captured in this pass; recommended follow-up:
  - Run `npm run build:staff`
  - Compare `dist/assets` chunk sizes before/after in CI artifacts.
