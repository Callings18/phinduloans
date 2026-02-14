
# Phindu V1.0.1 -- Simplify to Core LMS

## What We're Doing
Stripping the current system down to 7 clean navigation sections focused on the core lending workflow. All advanced features (Recovery, Payroll, Reports, PMIC, etc.) are hidden -- not deleted -- for V2.0.

## Changes Overview

### 1. Simplify Admin Sidebar Navigation
**File:** `src/components/admin/AdminSidebar.tsx`

Replace the current 8-section, 25-item navigation with a clean 4-section, 10-item layout:

```text
BEFORE (25+ items, 8 sections)        AFTER (10 items, 4 sections)
------------------------------        ---------------------------
Overview                              Overview
  Dashboard                             Dashboard
Lending                               Lending
  Applications                          Applications
  Borrowers                             Borrowers
  Employees          <-- HIDE           Loan Products
  Loan Products                         Loans
  Loans                               Operations
  Disbursements                         Disbursements
Payments                                Repayments
  Repayments                            Accounts
  Bulk Repayments    <-- HIDE         Settings
  PMIC               <-- HIDE          Contract Templates
Finance
  Accounts
  Expenses           <-- HIDE
Recovery             <-- HIDE ALL
  Collections
  Write-Offs
  Court Cases
Reports & Logs       <-- HIDE ALL
  Reports
  Audit Logs
HR & Payroll         <-- HIDE ALL
  HR Management
  Payroll
Administration       <-- HIDE MOST
  Staff
  Roles & Permissions
  Contracts          <-- KEEP
  Email Log
  User Guide
  Settings
```

- Remove all "New" badges (no longer needed)
- Remove permission checks (internal team = full access)
- All sections default open (only 4 sections)

### 2. Hide Borrower-Facing Routes
**File:** `src/App.tsx`

The borrower portal routes (`/dashboard`, `/profile`, `/apply`, `/pre-qualify`, `/calculator`) stay in the router but are not advertised. The landing page (`/`) and `/auth` remain as the entry points. No route deletion -- just the sidebar drives the experience.

### 3. Simplify AdminLayout
**File:** `src/components/admin/AdminLayout.tsx`

- Remove PhinduAI chatbot (unnecessary complexity for internal use)
- Keep AdminRealTimeNotifications (useful for staff)

### 4. Clean Up Dashboard Quick Actions
**File:** `src/components/admin/QuickActions.tsx`

Ensure quick actions align with V1 workflow:
- New Application
- Add Borrower
- Record Repayment
- (Remove any links to hidden modules)

---

## Technical Details

### AdminSidebar.tsx -- New Navigation Structure

The `menuGroups` array will be replaced with exactly these 4 groups:

| Section | Items | Icons |
|---------|-------|-------|
| Overview | Dashboard | LayoutDashboard |
| Lending | Applications, Borrowers, Loan Products, Loans | FileText, Users, Package, CreditCard |
| Operations | Disbursements, Repayments, Accounts | CreditCard, Banknote, Wallet |
| Settings | Contract Templates | FileSignature |

- All `adminOnly`, `permission`, and `badge` properties removed
- All groups set to `defaultOpen: true`
- Unused icon imports removed
- NotificationCenter and ThemeToggle kept in sidebar header

### AdminLayout.tsx -- Minor Cleanup

- Remove `PhinduAI` import and component render
- Keep `AdminSidebar` and `AdminRealTimeNotifications`

### App.tsx -- No Route Changes

Routes stay intact (code preserved for V2). The simplified sidebar simply doesn't link to hidden pages. If someone types `/admin/collections` directly, it still works -- this is intentional for admin flexibility.

---

## What Is NOT Changing
- No database changes
- No RLS policy changes
- No page component deletions
- No route removals
- All V2 code preserved intact
- Core workflow logic untouched

## Estimated Time
~15 minutes -- this is purely a navigation and layout cleanup.
