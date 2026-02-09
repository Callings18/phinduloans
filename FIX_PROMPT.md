# Loan Management System - Critical Fixes Required

## Overview
I need to fix several critical issues in my loan management system related to payment schedules, interest calculations, deletion permissions, and payment tracking. Please implement all fixes comprehensively.

---

## 1. DELETION PERMISSIONS

### 1.1 Borrower Deletion
- **Requirement**: Give Lender/Admin the ability to delete a borrower
- **Restriction**: Only allow deletion if the borrower has NO active loans (status: active, disbursed, approved, or completed)
- **Implementation**: 
  - Add safety check before deletion
  - Show clear error message if borrower has active loans (e.g., "Cannot delete borrower. This borrower has X active loan(s).")
  - Update the delete mutation in AdminBorrowers component

### 1.2 Loan Deletion
- **Requirement**: Give Lender/Admin the ability to delete a loan
- **Restriction**: Only allow deletion for loans that are NOT yet approved or disbursed
- **Allowed Statuses**: `pending`, `rejected`, `under_review`
- **Blocked Statuses**: `approved`, `disbursed`, `active`, `completed`, `defaulted`
- **Implementation**:
  - Add validation in delete mutation
  - Show warning in delete dialog if loan cannot be deleted
  - Update the delete mutation in AdminLoans component

---

## 2. PAYMENT SCHEDULE FIXES (CRITICAL)

### 2.1 Weekly Payment Schedule Generation
- **Problem**: Payment schedule shows monthly payments even when loan product is configured for weekly payments
- **Requirement**: 
  - When a loan product has `term_unit = 'weeks'` OR `interest_period = 'weekly'` OR `repayment_frequency = 'weekly'`, the payment schedule MUST show weekly payments with 7-day intervals
  - Example: If someone gets K1000 for 6 weeks, they must pay K200 per week for 6 weeks (K1000 / 6 = K166.67, but if configured as K200/week, use that)
  - Each payment should be due exactly 7 days after the previous one

### 2.2 Daily Payment Schedule Support
- **Requirement**: Support daily payment schedules when `term_unit = 'days'` OR `interest_period = 'daily'` OR `repayment_frequency = 'daily'`
- **Implementation**: Each payment should be due exactly 1 day after the previous one

### 2.3 Payment Schedule Display
- **Problem**: Payment schedule is showing months when it should show the correct frequency (daily/weekly/monthly)
- **Requirement**:
  - Display payment schedule with correct frequency based on loan product settings
  - Show dates in the correct format (daily: every day, weekly: every 7 days, monthly: every month)
  - Update all UI components that display payment schedules

### 2.4 Database Trigger Update
- **Requirement**: Update the `generate_repayment_schedule()` database function to:
  - Detect payment frequency from loan product (`term_unit`, `interest_period`, `repayment_frequency`)
  - Generate schedules with correct intervals (1 day, 7 days, or 1 month)
  - Calculate correct number of installments based on frequency

---

## 3. INTEREST CALCULATION FIXES (CRITICAL)

### 3.1 Weekly Interest Calculation
- **Problem**: When interest is set as "1.87% per week", the system is calculating it per month and miscalculating
- **Requirement**:
  - For weekly interest rates, calculate interest PER WEEK, not per month
  - Do NOT normalize weekly interest rates to monthly (e.g., 1.87% per week should NOT become 1.87% × 4.33 = 8.1% per month)
  - Calculate total interest as: Principal × Weekly Rate × Number of Weeks
  - Example: K1000 at 1.87% per week for 6 weeks = K1000 × 0.0187 × 6 = K112.20 interest

### 3.2 Daily Interest Calculation
- **Requirement**: Support daily interest rates
  - Calculate interest PER DAY
  - Total interest = Principal × Daily Rate × Number of Days

### 3.3 Interest Period Handling
- **Requirement**: 
  - Update `calculateLoan()` function to handle weekly/daily interest correctly
  - Do not normalize weekly/daily rates to monthly for calculation
  - Only normalize for display purposes if needed

---

## 4. OUTSTANDING BALANCE CALCULATION

### 4.1 Outstanding Balance Accuracy
- **Requirement**: 
  - Verify outstanding balance calculation is correct for ALL loan types (daily, weekly, monthly)
  - Outstanding balance = Total Repayment - Total Paid
  - Must account for correct payment frequency when calculating
  - Check all existing loans and ensure they calculate correctly based on their loan product settings

### 4.2 Outstanding Balance Display
- **Requirement**: 
  - Display outstanding balance correctly in loan tables
  - Show outstanding balance in loan details modal
  - Ensure it updates correctly when payments are recorded

---

## 5. PAYMENT RECORDING AND TRACKING

### 5.1 Payment Status Indicators
- **Requirement**: When displaying payment schedule, show:
  - **When payment was paid**: Display paid date clearly
  - **Due dates**: Show when each payment is due
  - **Missed payments**: Highlight overdue payments with:
    - Red background/highlight
    - Days overdue count
    - "Overdue" badge
  - **Upcoming payments**: Show days remaining until due
  - **Due today**: Highlight payments due today with warning color

### 5.2 Payment Recording Alignment
- **Problem**: When recording a repayment, need to pick from the dates as per schedule aligned and know which one is for which date
- **Requirement**:
  - When recording payment, show the schedule date clearly
  - Display installment number and due date in payment dialog
  - Ensure payment is recorded against the correct schedule entry
  - Show payment method and transaction reference after payment is recorded

### 5.3 Payment Schedule Table Enhancement
- **Requirement**: Update payment schedule table to show:
  - Installment number
  - Due date (formatted correctly based on frequency)
  - Amount due
  - Penalty amount (if any)
  - Total due (amount + penalty)
  - Status badge (Pending, Paid, Overdue, Due Today)
  - Paid date (if paid)
  - Payment method (if paid)
  - Transaction reference (if paid)
  - Days overdue (for overdue payments)
  - Days remaining (for upcoming payments)

---

## 6. CODE CHANGES REQUIRED

### 6.1 Files to Update
1. **`src/utils/loanCalculations.ts`**:
   - Fix `calculateLoan()` to handle weekly/daily interest correctly
   - Fix `generateRepaymentSchedule()` to support weekly/daily schedules
   - Add support for `term_unit` parameter

2. **`src/pages/admin/AdminLoans.tsx`**:
   - Add loan deletion restriction (only pending/rejected/under_review)
   - Update loan calculation to use correct `term_unit`
   - Fix payment schedule display

3. **`src/pages/admin/AdminBorrowers.tsx`**:
   - Add borrower deletion with active loan check
   - Show error if borrower has active loans

4. **`src/components/admin/LoanDetailsModal.tsx`**:
   - Enhance payment schedule table with status indicators
   - Show paid dates, payment methods, transaction references
   - Highlight overdue and due today payments
   - Fix payment recording to align with schedule dates

5. **Database Migration**:
   - Update `generate_repayment_schedule()` function to support daily/weekly/monthly
   - Add functions: `can_delete_loan()` and `can_delete_borrower()`

---

## 7. TESTING REQUIREMENTS

After implementation, please verify:
1. ✅ Create a weekly loan (K1000 for 6 weeks at 1.87% per week) - verify schedule shows 6 weekly payments
2. ✅ Create a daily loan - verify schedule shows daily payments
3. ✅ Try to delete a borrower with active loans - should be blocked
4. ✅ Try to delete an approved/disbursed loan - should be blocked
5. ✅ Try to delete a pending/rejected loan - should work
6. ✅ Record a payment - verify it shows correct schedule date and updates status
7. ✅ Check outstanding balance calculation for all loan types
8. ✅ Verify interest calculation for weekly loans (should not normalize to monthly)

---

## 8. SQL MIGRATION REQUIRED

Please provide SQL commands to:
1. Update `generate_repayment_schedule()` function for daily/weekly/monthly support
2. Add `can_delete_loan()` function
3. Add `can_delete_borrower()` function

---

## PRIORITY
- **CRITICAL**: Payment schedule frequency fixes (#2)
- **CRITICAL**: Interest calculation fixes (#3)
- **HIGH**: Payment tracking enhancements (#5)
- **HIGH**: Outstanding balance verification (#4)
- **MEDIUM**: Deletion permissions (#1)

---

Please implement all fixes comprehensively and ensure backward compatibility with existing loans. After implementation, commit and push all changes to the main branch, and provide the SQL migration commands.
