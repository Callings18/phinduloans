# Phase 3 — Deep Workflow Audit

**Date:** 2026-07-08  
**Scope:** Prove business flows work end-to-end (code trace + automated checks). UI polish out of scope.  
**Aligned with:** [CLIENT_READINESS_BACKLOG.md](./CLIENT_READINESS_BACKLOG.md) · [LAUNCH_MATRIX_UAT.md](./LAUNCH_MATRIX_UAT.md) · [QA_SIGNOFF_CHECKLIST.md](./QA_SIGNOFF_CHECKLIST.md) · [RLS_UI_MATRIX.md](./RLS_UI_MATRIX.md) · [PHASE3_HANDOVER.md](./PHASE3_HANDOVER.md)

## Status legend

| Status | Meaning |
|--------|---------|
| **AUDIT** | Code path traced; implementation appears complete — needs staging UAT to confirm |
| **NEEDS-UAT** | Code exists but complaint pattern or RLS/env dependency requires live verification |
| **GAP** | Missing server enforcement, dual code paths, or config not wired |
| **BUG** | Confirmed logic/RLS/navigation defect (fixed in this phase where marked ✅) |

## Product houses (reference)

| Code | Borrower portal | House admin route | Term unit | Notable DB trigger rules |
|------|-----------------|-------------------|-----------|--------------------------|
| `SALARY_ADVANCE` | Yes | `/admin/houses/SALARY_ADVANCE` | months (1) | `civil_servant_confirmed`, employed/contract |
| `SALARY_ADVANCE_STAFF` | If `channels` includes website | `/admin/houses/SALARY_ADVANCE_STAFF` | months (1) | Same + max 3k |
| `PAYDAY_SOFT` | Yes | `/admin/houses/PAYDAY_SOFT` | days (30) | Lusaka only |
| `COLLATERAL` | Yes | `/admin/houses/COLLATERAL` | months (1–12) | Multi-borrower, flat interest |
| `BUSINESS` | Yes | `/admin/houses/BUSINESS` | months | Self-employed/contract |
| `MOTOR_VEHICLE` | Yes | `/admin/houses/MOTOR_VEHICLE` | months (3–24) | Vehicle docs |
| `MARKETEER` | Yes | `/admin/houses/MARKETEER` | days (26) | Local authority + 6 mo business |

DB enforcement: `enforce_house_product_rules()` — `supabase/migrations/20260604160000_restore_house_product_enforce_rules.sql`

---

## Automated check results

| Command | Result | Notes |
|---------|--------|-------|
| `npm run typecheck` | **PASS** | staff-web + borrower-mobile clean |
| `npm run test` | **SKIP** | Root `vitest.config.ts` only includes `src/**` + `tests/integration/**`; package unit tests under `packages/shared/src/**/__tests__` not in include glob |
| `npm run test:integration:loan-flow` | **SKIP (7)** | Requires `E2E_SUPABASE_URL`, `E2E_SUPABASE_SERVICE_ROLE_KEY`, `E2E_STAFF_USER_ID` |

**Recommendation:** Run `npm run test:integration:loan-flow` on CI with secrets per [PHASE3_HANDOVER.md](./PHASE3_HANDOVER.md).

---

## Borrower workflow matrix

| Flow | Code path | DB tables | RLS / gate | Status | House notes |
|------|-----------|-----------|------------|--------|-------------|
| **Registration** | `Auth.tsx` → `PhoneAuthForm` (`purpose=signup`) → Edge `send-otp` / `verify-otp` | `otp_codes`, `profiles`, `auth.users`, `notification_logs` | Service role in Edge fns | **NEEDS-UAT** | NRC at signup; vault KYC still required separately |
| **OTP** | `PhoneAuthForm.handleSendOTP` / `handleVerifyOTP` | `otp_codes`, `system_settings` | Service role; rate limit 5/10min | **AUDIT** | Login requires existing `profiles.phone` |
| **Login** | `Auth.tsx` → `PhoneAuthForm` (`login`) → magic link session | `otp_codes`, `profiles` | Service role | **NEEDS-UAT** | Staff brief flash on `/dashboard` before admin redirect |
| **Dashboard** | `Dashboard.tsx` — tabs, realtime subs | `loan_applications`, `loan_repayments`, `profiles`, `borrower_document_vault`, `payment_claims`, `loan_events` | Own-row SELECT; staff house scope additive | **AUDIT** | `BorrowerInstallGate` on web PWA |
| **Loan Products** | `LoanApplicationForm` step 0 — `loan_products` + `isBorrowerPortalProduct()` | `loan_products` | Authenticated read | **AUDIT** | `SALARY_ADVANCE_STAFF` visible if channel includes website |
| **Calculator** | `LoanApplicationForm` → `calculateLoan()`; `EligibilityWidget` (DTI estimate) | `loan_products`, `profiles.net_income` | Read-only | **AUDIT** | `QuickApply.tsx` exists but not wired; no channel filter |
| **Apply** | `/apply` → `/dashboard` or `/auth?next=/dashboard` ✅; form via dashboard tab / `?apply=true` | — (pre-submit) | Auth required | **AUDIT** ✅ | Redirect param fixed (`next` not `redirect`) |
| **Upload NRC/Payslips/Collateral/Selfie** | Vault: `ProfileDocumentVault` → `borrower_document_vault`; App step: `LoanApplicationForm` → `application_documents` + storage `loan-documents`; Post-submit: `DocumentChecklist` | `borrower_document_vault`, `application_documents`, `document_checklists`, storage | Vault: borrower ALL; app docs: borrower INSERT/SELECT only (no UPDATE) | **NEEDS-UAT** ✅ | Re-upload now INSERT + `pending_review` ✅; vault copy on submit ✅ |
| **Submit** | `LoanApplicationForm.handleSubmit` | `loan_applications`, `loan_borrowers`, `product_house_borrowers`, `application_documents` | INSERT own app; trigger `enforce_house_product_rules` | **NEEDS-UAT** ✅ | `term_unit`, `product_specific_data` (civil servant, marketeer) ✅ fixed |
| **Notification** | `NotificationCenter` + dashboard realtime toasts; Edge `send-notification` | `notification_inbox`, `notification_logs` | Own inbox RLS | **NEEDS-UAT** | Multiple toast sources may duplicate |
| **Loan Status** | `ApplicationStatusTracker`, `BorrowerLoansTab`, `fetchBorrowerLoanEvents` | `loan_applications`, `loan_events`, `loan_notes` | Visibility filter on events | **NEEDS-UAT** | Status desync complaint — verify realtime + query invalidation on staging |
| **Contract** | `ContractSigningWidget` — loans in `approved\|contract_signing\|awaiting_disbursement` | `loan_applications` (`contract_url`, `signed_contract_url`) | Borrower SELECT own | **AUDIT** | Term label always "months" (cosmetic) |
| **Signature** | `ContractSigningWidget` — draw/upload → storage → UPDATE `borrower_signed*` | `loan_applications`, storage, `audit_logs` | `"Borrowers can sign their own contracts"` | **NEEDS-UAT** | Client-side status advance after sign |
| **Repayment Schedule** | `Dashboard.downloadSchedule*` / `BorrowerLoansTab` | `loan_repayments`, `loan_applications` | Own repayments SELECT | **NEEDS-UAT** | Schedule from DB rows at disbursement |
| **Repayment History** | `BorrowerPaymentsTab` | `loan_repayments`, `payment_claims` | Own rows | **NEEDS-UAT** | "Repayments not reducing" — verify `record_loan_payment` + claim review on staging |
| **Payment claim** | `BorrowerPaymentsTab` → `submitPaymentClaim()` in `workflowRepository.ts` | `payment_claims`, storage | Borrower INSERT; review needs API if Phase1 on | **NEEDS-UAT** | See RLS/env section |
| **Profile** | `BorrowerProfileTab`, `/profile`, `BorrowerKycSheet` | `profiles`, `borrower_kyc_info`, `borrower_document_vault`, `borrower_references` | Own-row policies | **AUDIT** | Overlap dashboard vs `/profile` |
| **Logout** | `useAuth.signOut()` → `/auth` | — | Session only | **AUDIT** | — |

### Borrower counts (post-audit)

| Status | Count |
|--------|------:|
| AUDIT | 8 |
| NEEDS-UAT | 10 |
| GAP | 0 |
| BUG (fixed this phase) | 4 |

---

## Admin workflow matrix

| Flow | Code path | DB tables | RLS / permission | Status | House notes |
|------|-----------|-----------|------------------|--------|-------------|
| **View Application** | `AdminApplications.tsx` (`useQuery admin-applications`); `LoanDetailsModal`; `HouseLoanDetailPage` | `loan_applications`, `profiles`, `loan_products` | `loans:view`; house `house:dashboard_view` | **AUDIT** | Dual UIs (legacy inbox vs house) |
| **View/Download docs** | `ApplicationDocumentsTab`, `DocumentVerificationTab` → `getSignedUrl` | `application_documents`, `document_checklists`, storage | Staff SELECT; borrower INSERT only | **NEEDS-UAT** | Triple doc system (checklist + app_docs + legacy URL cols) |
| **Approve** | Primary: `AdminApplications` → `transition_loan_status('approve')`; Alt: `ApprovalWorkflowTab` direct UPDATE ⚠️ | `loan_applications`, `audit_logs`, `loan_status_transitions` | `loans:approve` / `finance_approve` in RPC | **GAP** | House: `houseStageReview` → RPC ✅ |
| **Reject** | `AdminApplications` → `transition_loan_status('reject')` | Same as approve | Same | **AUDIT** | `ApprovalWorkflowTab` has no reject |
| **Notes** | `loan_notes.insert` (Applications, ApprovalWorkflowTab); `admin_notes` on loan row | `loan_notes`, `loan_applications` | Staff INSERT | **GAP** | `note_type`: `borrower_visible` vs `visible_to_borrower` inconsistent |
| **Generate/Send Contract** | `generateLoanContract.ts` → storage + `contract_url`; WhatsApp/email/SMS helpers | `loan_applications`, `system_settings`, storage | Staff UPDATE | **NEEDS-UAT** | Orphan blobs on regenerate |
| **Borrower Signature** | Borrower: `ContractSigningWidget`; Admin upload: `uploadSignedContractMutation` | `loan_applications`, storage | Borrower sign policy | **GAP** | Admin upload sets `borrower_signed=true` |
| **Verify Signature (admin)** | `adminSignContractMutation` — direct UPDATE | `loan_applications` | Staff UPDATE | **GAP** | No PDF validation; RPC approve auto-`admin_signed` |
| **Disburse** | `disburseMutation` → INSERT `disbursements` + `complete_disbursement` RPC; `HouseDisbursementsPage` | `disbursements`, `accounts`, `account_transactions`, `loan_applications` | UI: `disbursement:disburse`; RPC: `disbursement:approve\|manage` | **NEEDS-UAT** | **RLS vs RPC permission mismatch** — loan_officer may fail INSERT |
| **Activate Loan** | Bundled in `complete_disbursement` (`disbursed`→`active`); no separate UI | `loan_applications`, `loan_repayments` | RPC status guard | **AUDIT** | Schedule gen failure → active without installments risk |
| **Record Repayment** | `LoanDetailsModal.recordPayment` → `record_loan_payment` RPC; `AdminRepayments`; `houseWorkflowRepository` | `loan_repayments`, `accounts`, `account_transactions`, `audit_logs` | RPC role check (not `repayments:record` perm) | **NEEDS-UAT** | Primary path for balance correctness |
| **Reverse Repayment** | `LoanDetailsModal.reversePaymentMutation` — client multi-step; `houseReverseLastPayment` | `loan_repayments`, `accounts`, `account_transactions` | Staff UPDATE | **GAP** | Non-atomic; no undo of cascade allocations |
| **Restructure** | `LoanDetailsModal.restructureLoanMutation`; `houseRestructureLoan` | `loan_applications`, `loan_repayments`, `loan_events` | Staff UPDATE | **GAP** | No atomic RPC |
| **Re-loan** | `LoanDetailsModal.reloanMutation` → new loan **`active`**; House → **`pending`** | `loan_applications`, `disbursements` | Staff INSERT | **GAP** | Legacy vs house behavior diverges |
| **Settlement** | Quote: `calculate_early_settlement`; Process: `LoanDetailsModal` direct UPDATE ⚠️; House: `houseEarlySettlement` via RPC loop | `loan_applications`, `loan_repayments` | Staff / owner | **GAP** | Legacy modal bypasses `record_loan_payment` — wrong balances |
| **Write-off** | `WriteOffTab` INSERT; `AdminWriteOffs` → approve/reject RPCs | `loan_writeoffs`, `loan_applications` | `writeoffs:view` / `writeoffs:manage` | **AUDIT** | Request INSERT has no component-level perm check |
| **Reports** | `AdminReports.tsx`, `HouseReportsPage` | `loan_applications`, `loan_repayments`, `disbursements` | `reports:view` / `reports:export` | **NEEDS-UAT** | Reversed payments may skew if not filtered |
| **Audit Logs** | `AdminAuditLogs.tsx` | `audit_logs` | Route: `audit:view`; RLS: admin/super_admin/auditor **roles only** | **GAP** | Permission ≠ RLS |

### Admin counts

| Status | Count |
|--------|------:|
| AUDIT | 5 |
| NEEDS-UAT | 5 |
| GAP | 8 |
| BUG | 0 |

### Key RPCs (migrations)

| RPC | Migration | Used by |
|-----|-----------|---------|
| `transition_loan_status` | `20260410120000_restore_transition_loan_status_full.sql` | AdminApplications, house review |
| `complete_disbursement` | `20260506094111_58b48478-ca99-4d1f-916c-ebf761e9c2b7.sql` | Disburse mutations |
| `record_loan_payment` | `20260610212831_c6a0bc22-cde9-414b-b314-ac9594a251f4.sql` | Repayments, house collections |
| `calculate_early_settlement` | `20260202171314` (grep) | Settlement quote |
| `enforce_house_product_rules` | `20260604160000` | Trigger on `loan_applications` INSERT/UPDATE |

### Shared utilities

| Module | Path | Role |
|--------|------|------|
| `loanCalculations` | `packages/shared/src/utils/loanCalculations.ts` | Product pricing, payday/marketeer/collateral |
| `createRepaymentSchedule` | `packages/shared/src/utils/createRepaymentSchedule.ts` | Client schedule preview; DB trigger at disburse |
| `paymentAllocation` | `packages/shared/src/utils/paymentAllocation.ts` | Client preview; must match `record_loan_payment` |
| `handlePaymentReceipt` | `packages/shared/src/utils/handlePaymentReceipt.ts` | Receipt PDF |
| `generateLoanContract` | `packages/shared/src/utils/generateLoanContract.ts` | Contract PDF + storage |
| `workflowRepository` | `packages/shared/src/services/repositories/workflowRepository.ts` | Payment claims, transitions (API gate) |

---

## RLS / environment risks

### `VITE_API_PHASE1_WORKFLOW`

| Setting | Borrower payment claims | Staff claim review | Loan transitions |
|---------|-------------------------|--------------------|------------------|
| `true` + `VITE_API_URL` | `POST /api/v1/repayments/:id/payment-claims` | `GET/POST` admin claim endpoints | API `POST /api/v1/loans/:id/transitions` |
| `false` (default) | Direct `payment_claims.insert` | **Fails** — `reviewPaymentClaim` throws | Direct Supabase / RPC only where wired |

**Risk:** Staging with API off → borrowers submit claims but staff cannot review → "repayments not reducing" symptom.  
**Mitigation:** Match [QA_SIGNOFF_CHECKLIST.md](./QA_SIGNOFF_CHECKLIST.md) — enable Phase1 on staging when `api-next` is deployed.

### Route guards

| Surface | Guard | Failure mode |
|---------|-------|--------------|
| `/admin/*` | `AdminRoute` — `isStaff` | Redirect to `/dashboard` or `/auth` |
| Admin modules | `PermissionRoute` — `has_permission` via `get_my_permissions` | Error panel if RPC fails |
| `/dashboard`, `/apply` | Auth required; staff → `/admin` | Borrower blocked from admin |
| House routes | `house:*` permissions + product scope RLS | Empty lists or 403 on save |

### Common RLS failure modes ([RLS_UI_MATRIX.md](./RLS_UI_MATRIX.md))

1. **Button enabled, save fails** — UI permission from `get_my_permissions` but table RLS uses `has_role()` (e.g. disbursement INSERT needs `disbursement:disburse`, RPC needs `disbursement:approve`).
2. **Borrower doc re-upload** — was UPDATE on `application_documents` (admin-only); fixed to INSERT ✅.
3. **Audit logs empty** — user has `audit:view` permission but not `auditor` role in RLS.
4. **`get_my_permissions` failure** — non–super_admin sees error panel on all gated routes.
5. **House scope** — staff without product assignment sees no rows (not an error toast).
6. **Payment claims** — unique pending index per repayment; duplicate submit shows DB error.

---

## Code fixes applied (Phase 3)

| File | Fix |
|------|-----|
| `apps/borrower-mobile/src/components/dashboard/LoanApplicationForm.tsx` | Persist `term_unit`, `civil_servant_confirmed`, marketeer JSON fields; link vault identity docs to `application_documents` on submit |
| `apps/borrower-mobile/src/pages/Apply.tsx` | Auth redirect `?next=/dashboard` (was broken `?redirect=`) |
| `apps/borrower-mobile/src/components/dashboard/DocumentChecklist.tsx` | Re-upload via INSERT + valid status `pending_review` (was invalid `submitted` + blocked UPDATE) |

---

## Top 10 manual UAT items (staging, prioritized)

1. **Borrower apply → submit** for each house (especially Salary Advance, Payday Soft, Marketeer) — confirm no trigger exception after fixes.
2. **KYC vault → apply without re-uploading identity** — staff sees docs in `DocumentVerificationTab`.
3. **Full disbursement** as finance user on house disbursements page — account debited, loan `active`, schedule rows exist.
4. **Record repayment** on house collections — principal/penalty allocation reduces balance; loan completes when fully paid.
5. **Borrower payment claim** with `VITE_API_PHASE1_WORKFLOW=true` — submit + staff approve — balance updates.
6. **Contract flow** — generate → borrower sign → admin sign → disburse (status chain).
7. **Document re-upload** after rejection via `DocumentChecklist` on borrower dashboard.
8. **Disbursement as loan_officer** on global `/admin/disbursements` — confirm RLS allows or denies consistently with UI.
9. **Early settlement** on house collections vs legacy `LoanDetailsModal` — compare balance after settlement.
10. **Status realtime** — borrower dashboard updates when staff approves/disburse without manual refresh.

### Recommended client test order

1. Environment check (Supabase URL, migrations through `20260604160000`, API Phase1 flag).  
2. One golden-path house end-to-end (**COLLATERAL** or **SALARY_ADVANCE**).  
3. Remaining houses apply + disburse smoke.  
4. Repayment + claim cycle.  
5. Edge flows: reject, doc rejection/re-upload, write-off request.  
6. Reports export spot-check.

---

## Sign-off recommendation

| Question | Answer |
|----------|--------|
| Code review sign-off? | **Yes** — borrower P0 submit/doc paths fixed; admin paths traced; gaps documented |
| Production sign-off? | **No** — staging UAT required first (10 items above) |
| Phase 3 complete? | **Conditional** — audit artifact done; critical borrower bugs fixed; admin GAPs deferred to Phase 4+ |

**Overall matrix totals:** AUDIT 13 · NEEDS-UAT 15 · GAP 8 · BUG fixed 4

---

## Deferred (not Phase 3)

- Consolidate `ApprovalWorkflowTab` to use `transition_loan_status` RPC
- Atomic `reverse_loan_payment` / settlement RPCs
- Align disbursement RLS with RPC permissions
- Fix `note_type` inconsistency for borrower-visible notes
- Root vitest config to include `packages/**/__tests__`
- HR/payroll parallel run (out of loans scope per [CLIENT_READINESS_BACKLOG.md](./CLIENT_READINESS_BACKLOG.md))
