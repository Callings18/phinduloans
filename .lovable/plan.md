
# Full Loan Flow Alignment -- Borrower vs Admin Synchronization

## Summary of Gaps Found

After a thorough audit of the codebase against your specification, here is what is already implemented and what needs work:

### Already Working (No Changes Needed)
- Account creation with email/password + OTP-based passwordless login
- Duplicate NRC + phone unique index on profiles
- Blacklist enforcement on Apply page (with expiry support)
- Loan product configuration (interest, fees, terms, CRB, PMIC, required documents)
- Duplicate loan prevention (borrower and admin sides)
- Real-time status sync (borrower dashboard subscribes to `postgres_changes`)
- Admin loan lifecycle: approve, reject, disburse with source account balance check
- Repayment schedule auto-generation on disbursement completion (DB trigger)
- Penalty calculation and auto-apply via DB functions
- Contract signing widget (borrower signs digitally, uploads signature)
- Admin counter-signature verification (dual-signature locking)
- Clearance notifications on completion (DB trigger)
- Audit logging for loan changes and repayments (DB triggers)
- Document vault for borrower reuse
- Admin document verification tab with payslip password display
- Collections and court case modules
- Accounts/ledger integration for disbursements
- Role-based sidebar navigation (7 staff roles)

### Gaps to Fix (Grouped by Priority)

---

## Phase 1: Status Pipeline Alignment (Critical)

**Problem:** The database `loan_status` enum is missing `contract_signing`. The borrower status tracker skips the Contract Signing step. The admin Loans page does not show `contract_signing` as a valid workflow step.

**Changes:**

1. **Database migration** -- Add `contract_signing` to the `loan_status` enum:
   ```sql
   ALTER TYPE public.loan_status ADD VALUE IF NOT EXISTS 'contract_signing' AFTER 'approved';
   ```

2. **ApplicationStatusTracker.tsx** -- Add `contract_signing` step between "Approved" and "Disbursed" in the status timeline with messaging: "Please sign your contract to proceed."

3. **AdminLoans.tsx status flow** -- When admin clicks "Approve", the status should transition to `approved`. When the contract is generated and sent, status moves to `contract_signing`. After both signatures are verified, admin can proceed to disburse.

4. **LoanDetailsModal.tsx** -- Add a visible contract-signing verification step: show borrower signature status, allow admin to counter-sign, and only enable the "Disburse" button when `admin_signed = true`.

5. **ContractSigningWidget.tsx** -- Update query to also fetch loans with status `contract_signing` (not just `approved`), since the borrower needs to sign during this stage.

---

## Phase 2: Admin Dashboard Missing Metrics

**Problem:** The admin dashboard is missing some required KPIs from your spec.

**Changes to AdminDashboard.tsx:**

1. Add **"Loans Due Today"** count (repayments where `due_date = today` and `status = pending`)
2. Add **"Blacklisted Borrowers"** count (profiles where `is_blacklisted = true` and blacklist has not expired)
3. Add **"Principal Outstanding"** vs **"Interest Outstanding"** split (currently combined as "Outstanding Balance")
4. Add **"Defaulted Loans"** count to stats grid

---

## Phase 3: Borrower "Under Review" Document Checklist

**Problem:** When a loan is under review, borrowers cannot see which documents were approved/rejected/missing or re-upload.

**Changes to Dashboard.tsx / ApplicationStatusTracker.tsx:**

1. When status is `under_review`, show a document checklist panel pulled from `application_documents` for that loan
2. Each document shows status: Submitted / Verified / Rejected (with reason)
3. Allow borrower to re-upload rejected documents
4. Admin marks documents as verified/rejected in the existing DocumentVerificationTab

---

## Phase 4: Blacklist Duration Support in Admin

**Problem:** The `blacklist_expires_at` column exists but the admin UI does not let staff set a duration.

**Changes to AdminBorrowers.tsx:**

1. Add a "Duration" field (optional) to the blacklist dialog: number of days, or "Permanent"
2. When saving, calculate `blacklist_expires_at = now + duration` or `null` for permanent
3. Display expiry date on the borrower card when blacklisted

---

## Phase 5: Auth Event Logging

**Problem:** The `log_auth_event` function exists but is never called from the frontend after login/signup.

**Changes to useAuth.tsx:**

1. After successful `signIn`, call `supabase.rpc('log_auth_event', { p_action: 'LOGIN' })`
2. After successful `signUp`, call `supabase.rpc('log_auth_event', { p_action: 'SIGNUP' })`

---

## Technical Details

### Database Migration (Phase 1)

```sql
-- Add contract_signing to the loan_status enum
ALTER TYPE public.loan_status ADD VALUE IF NOT EXISTS 'contract_signing' AFTER 'approved';
```

### Files to Modify

| File | Phase | Change |
|------|-------|--------|
| `src/components/dashboard/ApplicationStatusTracker.tsx` | 1 | Add `contract_signing` step to timeline |
| `src/components/dashboard/ContractSigningWidget.tsx` | 1 | Query `approved` OR `contract_signing` status |
| `src/pages/admin/AdminLoans.tsx` | 1 | Include `contract_signing` in applications tab filter and status config |
| `src/components/admin/LoanDetailsModal.tsx` | 1 | Add contract verification gate before disburse |
| `src/constants/loanStatusLabels.ts` | 1 | Already correct (has `contract_signing`) |
| `src/pages/admin/AdminDashboard.tsx` | 2 | Add missing KPI cards |
| `src/pages/Dashboard.tsx` | 3 | Add document checklist for `under_review` loans |
| `src/pages/admin/AdminBorrowers.tsx` | 4 | Add duration field to blacklist dialog |
| `src/hooks/useAuth.tsx` | 5 | Log auth events after login/signup |

### Implementation Order

1. Database migration (enum change) -- must come first
2. Status pipeline UI alignment (both admin and borrower)
3. Dashboard metrics enhancement
4. Borrower document checklist during review
5. Blacklist duration UI
6. Auth event logging

### What This Does NOT Change (Already Working)

- Notification triggers (approval, rejection, disbursement, payment) -- working via DB triggers
- Loan product configuration -- fully configurable
- CRB and PMIC modules -- available in admin
- Dual-signature contract workflow -- implemented
- Disbursement accounting integration -- working with balance checks
- Collections, write-offs, court cases -- all functional
- Real-time status updates on borrower dashboard -- subscribed to postgres_changes
- Audit trail for all loan changes -- DB trigger active
