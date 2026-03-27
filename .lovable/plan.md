

# Plan: Client Feedback Fixes (5 Items)

## 1. Repayments Not Showing Amount Paid + Receipt

**Problem**: The repayment table in both LoanDetailsModal and AdminRepayments shows the *remaining* amount (after partial payment) instead of showing what was actually paid. For Twiza who paid K2,700 — the `amount` column gets reduced to the remainder, and there's no "Amount Paid" column visible.

**Fix**:
- **LoanDetailsModal repayment table** (lines ~1730-1878): Add "Paid" column showing `principal_paid` value when status is paid or partially paid. Show original amount vs remaining clearly.
- **AdminRepayments table** (lines ~771-893): Add "Paid" column showing `principal_paid`. For paid rows, show the actual amount paid. Add a "Download Receipt" button for each paid repayment row (already exists but only shows for fully paid — ensure it also works for partial payments).
- **Receipt generation**: The receipt already exists (`generateRepaymentReceipt.ts`). Ensure the receipt shows the partial payment amount correctly and remaining balance.
- **Stats fix**: `totalCollected` stat uses `r.amount` for paid records — but for partial-then-full payments, the amount gets restored to `original_amount`. Need to use `principal_paid` where available for accurate collection totals.

**Files**: `src/components/admin/LoanDetailsModal.tsx`, `src/pages/admin/AdminRepayments.tsx`

---

## 2. Reloan Rules Enforcement

**Problem**: Current reloan creates a new loan for the full `loan_amount` (principal) regardless of what's been paid. It also marks all pending repayments as paid (incorrect — interest and penalties must be cleared first).

**New Rules**:
- Reloan amount = outstanding principal only (not interest, not penalties)
- Before reloan: borrower must have cleared all interest and penalties
- System blocks reloan if interest or penalties are still outstanding
- New loan = remaining principal amount only

**Fix** in `LoanDetailsModal.tsx` reloan mutation (lines ~664-788):
1. Calculate: `totalPaid` from paid repayments, `outstandingPrincipal = loan.loan_amount - totalPrincipalPaid`
2. Check: all interest and penalties must be paid. If `pendingInterest > 0 || totalPenalties > 0`, block with error message
3. New loan uses `outstandingPrincipal` as `loan_amount` (not the original amount)
4. Recalculate `total_repayment` and `monthly_payment` using `calculateLoan()` with the reduced principal
5. Update the Reloan confirmation dialog to show these rules and the calculated reloan amount

**Files**: `src/components/admin/LoanDetailsModal.tsx`

---

## 3. Remove Contract Upload Feature

**Problem**: Client wants to generate contracts in-system but handle physical signing/filing manually. Remove the upload signed contract functionality.

**Remove from LoanDetailsModal.tsx**:
- Remove the "Upload Signed Contract" section in Contract tab (lines ~1971-1996)
- Remove `uploadSignedContractMutation` (lines ~983-1011)
- Remove `signedContractFile` state
- Keep: Generate Contract button, Download, View, Email/WhatsApp/SMS sharing
- Keep the signed contract viewing if one already exists (don't break existing data)
- Remove the overview tab's "Upload" button that redirects to contract tab (line ~1646)
- Remove the completion check that requires `borrower_signed && admin_signed` — since contracts are manual now, loan completion should only check all repayments are paid

**Also update**: LoanDetailsModal completion check (line ~448) and AdminRepayments completion check (line ~289) — remove the contract signing requirement.

**Files**: `src/components/admin/LoanDetailsModal.tsx`, `src/pages/admin/AdminRepayments.tsx`

---

## 4. Custom Messaging from Loan Details

**Problem**: No ability to type a custom message to a borrower from the loan detail view. Only contract-specific sharing buttons exist.

**Add** a "Message Borrower" section in the LoanDetailsModal overview tab:
- Three send buttons: SMS, Email, WhatsApp
- A textarea for custom message
- A dropdown of pre-filled message templates based on loan events:
  - "Payment Reminder" — "Dear {name}, your next payment of K{amount} is due on {date}..."
  - "Payment Overdue" — "Dear {name}, your payment of K{amount} was due on {date} and is now {X} days overdue..."
  - "Loan Update" — "Dear {name}, there has been an update to your loan..."
  - "Payment Received" — "Dear {name}, we have received your payment of K{amount}..."
  - "Penalty Applied" — "Dear {name}, a penalty of K{amount} has been applied..."
  - "Defaulted Notice" — "Dear {name}, your loan has been marked as defaulted..."
  - "Settlement Offer" — "Dear {name}, we would like to offer you a settlement..."
  - "General Update" — blank template for free typing
- Templates auto-fill with borrower name, loan amount, due dates, balance
- Staff can edit the pre-filled text before sending
- Uses `sendDirectNotification` utility for sending

**Files**: `src/components/admin/LoanDetailsModal.tsx`

---

## 5. Automated SMS/Email Escalation for Defaults + Penalty Schedule

**Problem**: No automated escalation messaging before default. No automatic penalty application. Client wants:
- 3-day countdown reminders before due date (gentle → medium → harsh)
- Auto-default 24 hours after missed payment
- Auto-penalty: 15% every 7 days for 2 weeks max
- Notification on penalty application
- After 2 weeks of penalties → legal escalation notification

**Implementation**:

### A. Update payment-reminder-cron (Edge Function)
Currently sends generic reminders. Enhance to:
- **Day -3**: Gentle tone — "Dear {name}, just a friendly reminder that your payment of K{amount} is due in 3 days..."
- **Day -2**: Medium tone — "Dear {name}, your payment is due in 2 days. Please arrange payment..."
- **Day -1**: Firm tone — "Dear {name}, FINAL REMINDER: Your payment of K{amount} is due TOMORROW. Late payments will attract penalties and potential legal action..."
- **Day +1 (24h overdue)**: Auto-set loan status to "defaulted" + send default notification — "Dear {name}, your loan has been DEFAULTED. A penalty of 15% will be applied every 7 days..."
- **Day +7**: Auto-apply 15% penalty on principal, notify borrower with new balance
- **Day +14**: Auto-apply second 15% penalty, notify: "This is your final penalty period. If payment is not received, this matter will be referred to our legal team..."
- **Day +15+**: Send legal referral notice — "Dear {name}, your account has been referred to our legal department for recovery..."

### B. New DB function: `auto_apply_penalties_and_defaults`
- Called by the cron function
- Checks for loans 24h+ overdue → marks as defaulted
- Checks for loans 7 days overdue → applies first 15% penalty
- Checks for loans 14 days overdue → applies second 15% penalty (caps at 2 penalties max)
- Records penalty amounts and notifies

### C. Database migration
- Add `penalty_count` column to `loan_applications` (default 0, max 2) to track how many weekly penalties have been applied
- Add `defaulted_at` timestamp to track when default occurred
- Add `legal_referred_at` timestamp for legal escalation tracking

**Files**: 
- `supabase/functions/payment-reminder-cron/index.ts`
- New DB migration for penalty tracking columns
- New DB function for auto-penalties

---

## Implementation Order

1. Fix repayment display (amount paid columns + receipt) — immediate client pain
2. Remove contract upload feature — simple removal
3. Reloan rules enforcement — business logic fix  
4. Custom messaging from loan details — new feature
5. Automated escalation + penalty schedule — cron enhancement + migration

## Technical Notes

- All changes are in the admin module — borrower-facing code is untouched
- The penalty schedule (15% per 7 days, 2 weeks max) overrides the current product-level penalty settings for the automated flow
- The cron function already runs 3x daily; the escalation logic piggybacks on this schedule
- Message templates use string interpolation with loan data already available in the modal

