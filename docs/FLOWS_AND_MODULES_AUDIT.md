# Phindu Loans – Flows & Modules Audit

**Date:** 2026-02-09  
**Scope:** Borrower flow, Admin vs Borrower separation, Admin features, and module flows.

---

## 1. Route & access model

### 1.1 Route-level protection

- **App.tsx** – Admin routes are wrapped by **AdminRoute** (route-level guard). All `/admin/*` routes are nested under `<Route path="/admin" element={<AdminRoute />}>`. AdminRoute checks `user` and `isStaff` before rendering; redirects to `/auth` or `/dashboard` to avoid a brief flash of admin UI.
- **Protection is done at route + layout:**
  - **AdminRoute** (wraps `/admin/*`): requires `user` and `isStaff`; otherwise redirects to `/auth` or `/dashboard`; renders `<Outlet />` for nested admin pages.
  - **AdminLayout** (wraps every `/admin/*` page content): also requires `user` and `isStaff`; otherwise redirects or returns null. Redundant with AdminRoute but keeps defence in depth.
  - **Dashboard**: requires `user`; if `isAdmin` → redirect to `/admin`.
  - **Profile**: requires `user`; else → `/auth`.
  - **Apply**: submit requires `user`; else → `/auth`. Page itself is reachable without auth (form visible).

Admin access is enforced at route level (AdminRoute) and layout level (AdminLayout).

### 1.2 Roles (from `useAuth.tsx`)

- **isAdmin** = `admin` or `super_admin` only.
- **isStaff** = any of: `admin`, `super_admin`, `loan_officer`, `credit_officer`, `finance_officer`, `collections_officer`, `auditor`, `support`.
- **hasRole(role)** = exact role check.

### 1.3 Who can go where

| User type        | /dashboard | /admin/* | /apply | /profile |
|------------------|------------|----------|--------|----------|
| Not logged in    | Redirect /auth | Redirect /auth | Can view form; submit → /auth | Redirect /auth |
| Borrower (user)  | Yes        | No (AdminLayout → /dashboard) | Yes (submit if logged in) | Yes |
| Staff (e.g. loan_officer) | Yes       | Yes (AdminLayout allows isStaff) | Yes | Yes |
| Admin/super_admin | Redirect /admin | Yes | Yes | Yes |

---

## 2. Borrower flow

### 2.1 Apply (`/apply`)

- **Steps:** Personal Info → Employment → Loan Details → Documents.
- **Auth:** Page load does not require auth. On submit, if no `user` → `navigate('/auth')`.
- **Data:** Uses `user` for profile, previous application, borrower document vault, existing active loan checks (all queries `enabled: !!user?.id`).
- **Draft:** `useApplicationDraft` for save/restore.
- **Products:** Fetches active loan products; product-driven amount/term and document requirements.
- **Post-submit:** On success → `navigate('/dashboard')`.

### 2.2 Dashboard (`/dashboard`)

- **Guard:** No user → `/auth`. If `isAdmin` → `/admin` (admins never see this page).
- **Content:** User’s loans (by `user_id`), status tracker, payment reminders, Quick Apply, wallet widget, contract signing widget.
- **Real-time:** Subscription on `loan_applications` for status changes.
- **Statements/schedule:** Links to `generateAccountStatement`, `downloadLoanSchedule`.

### 2.3 Profile (`/profile`)

- **Guard:** No user → `/auth`.
- **Content:** View/edit profile (name, phone, NRC, address, city), notification preferences (email_reminders, sms_reminders, payment_alerts, marketing), document list from applications.

---

## 3. Admin vs borrower separation

### 3.1 Where it’s enforced

- **AdminLayout** – All admin pages use `AdminLayout`. It checks `user` and `isStaff`. If not staff → `/dashboard`. So only staff see any admin UI.
- **Dashboard** – Redirects `isAdmin` to `/admin`. So admins don’t use the borrower dashboard; staff (non-admin) can still use Dashboard as “borrower view” if they have that role.

### 3.2 Navbar behaviour

- **Navbar** uses **isAdmin** only (not isStaff):
  - If `isAdmin` → link label “Admin Dashboard”, href `/admin`.
  - Else → “My Dashboard”, href `/dashboard`.
- **Effect:** Staff who are not admin (e.g. loan_officer) see only “My Dashboard” and have no one-click link to Admin; they can still open `/admin` manually and AdminLayout will let them in. So staff admin access is possible but not advertised in the navbar.

### 3.3 Admin sidebar visibility

- **AdminSidebar** uses **isAdmin** for `adminOnly` items:
  - `visibleItems = group.items.filter(item => !item.adminOnly || isAdmin)`.
- So loan_officer etc. see all non–adminOnly links; only admin/super_admin see Loan Products, HR, Payroll, Staff, Contracts, Email Log, Settings.

---

## 4. Admin features (by module)

All under `/admin/*`, protected by AdminLayout (user + isStaff).

| Path | Page | Purpose | adminOnly |
|------|------|--------|-----------|
| `/admin` | AdminDashboard | Overview stats, charts, recent applications, quick links | No |
| `/admin/applications` | AdminApplications | List/filter applications, view/approve/reject, disburse, add loan, documents, risk assessment | No |
| `/admin/borrowers` | AdminBorrowers | List/search borrowers, add/edit/view/delete, blacklist, view loan history | No |
| `/admin/employers` | AdminEmployers | Employers (building/company records) | No |
| `/admin/loan-products` | AdminLoanProducts | Loan product CRUD, terms, requirements | Yes |
| `/admin/loans` | AdminLoans | Loan list / management | No |
| `/admin/disbursements` | AdminDisbursements | Disbursement list, complete with source account, contract signing checks | No |
| `/admin/repayments` | AdminRepayments | Repayments, mark paid | No |
| `/admin/bulk-repayments` | AdminBulkRepayments | Bulk repayment actions | No |
| `/admin/pmic` | AdminPMIC | PMIC enrollments / payroll integration | No |
| `/admin/accounts` | AdminAccounts | Finance accounts | No |
| `/admin/expenses` | AdminExpenses | Expenses | No |
| `/admin/collections` | AdminCollections | Collections / overdue | No |
| `/admin/write-offs` | AdminWriteOffs | Write-offs | No |
| `/admin/court-cases` | AdminCourtCases | Court cases | No |
| `/admin/reports` | AdminReports | Reports | No |
| `/admin/audit-logs` | AdminAuditLogs | Audit logs | No |
| `/admin/hr` | AdminHR | HR management | Yes |
| `/admin/payroll` | AdminPayroll | Payroll | Yes |
| `/admin/staff` | AdminStaff | Staff/roles | Yes |
| `/admin/contract-templates` | AdminContractTemplates | Contract templates | Yes |
| `/admin/email-log` | AdminEmailLog | Email log | Yes |
| `/admin/settings` | AdminSettings | System/notification settings | Yes |
| `/admin/wallets` | AdminWallets | Borrower wallets | No |

---

## 5. Key admin flows (summary)

### 5.1 Borrowers (AdminBorrowers)

- **List:** `profiles` + loan count per user.
- **Add:** Calls edge function `create-borrower` (creates auth user + profile).
- **Edit:** Update `profiles` (name, phone, NRC, address, city); email not editable.
- **View:** Profile details, email/phone verified flags, loan history, blacklist block, danger zone (delete).
- **Blacklist:** Set `is_blacklisted`, `blacklist_reason`, `blacklisted_at`, `blacklisted_by`, `blacklist_expires_at` (optional).
- **Delete:** Blocked if borrower has active/disbursed/approved/completed loans; otherwise delete profile.

### 5.2 Applications (AdminApplications)

- **List:** Paginated, filter by status/source, search.
- **View:** Full application, documents tab (ApplicationDocumentsTab), risk assessment (RiskAssessmentModule).
- **Actions:** Approve, reject (with reason/category), disburse (with source_account_id, method, reference), add new loan (select borrower + product, employment, amounts, documents).
- **Disbursement:** Requires borrower_signed and admin_signed where used; uses `source_account_id` for balance/account tracking.
- **Bulk actions:** Via BulkActions (e.g. bulk status updates).

### 5.3 Disbursements (AdminDisbursements)

- **Complete disbursement:** Contract signing checks (borrower + admin signed), source account selection; balance checks and account updates via DB/triggers.
- **canCompleteDisbursement:** `hasRole('admin') || hasRole('super_admin') || hasRole('finance_officer')`.

### 5.4 Loan products (AdminLoanProducts)

- **canEditProducts:** `hasRole('admin') || hasRole('super_admin')` (sidebar already restricts this page to adminOnly).

---

## 6. Findings and recommendations

### 6.1 Navbar vs AdminLayout (fixed)

- **Issue:** Navbar showed “Admin Dashboard” only when `isAdmin`. Staff (e.g. loan_officer) saw only “My Dashboard” but could access `/admin` (AdminLayout uses `isStaff`).
- **Fix applied:** Navbar now uses `isStaff` for the main dashboard link: when user is staff, the link label is “Admin” and href is `/admin`; otherwise “My Dashboard” and `/dashboard`. Staff can reach admin in one click. Staff who are also borrowers can still open `/dashboard` via URL or bookmark.

### 6.2 Route-level guard (optional)

- **Issue:** Admin protection is only inside AdminLayout; there is no central “protected admin route” in the router.
- **Recommendation:** Optionally add a wrapper component (e.g. `AdminRoute`) that checks `user` and `isStaff` and redirects before rendering admin routes, for clarity and to avoid any flash of admin content.

### 6.3 Borrower flow

- Apply: Auth required only on submit; profile/vault/loan checks are correctly gated by `user?.id`.
- Dashboard and Profile: Correctly require user and redirect to `/auth` when missing.
- Dashboard redirect of admins to `/admin` is consistent with “admin sees only admin UI” from the main entry.

### 6.4 Admin features

- **adminOnly** in AdminSidebar correctly hides Loan Products, HR, Payroll, Staff, Contracts, Email Log, Settings from non-admin staff.
- **hasRole** is used where needed (e.g. disbursement completion, loan product edit, risk assessment edit).
- RLS in Supabase enforces server-side access; front-end role checks align with sidebar and layout.

---

## 7. File reference (key files)

| Area | File |
|------|------|
| Routes | `src/App.tsx` |
| Auth & roles | `src/hooks/useAuth.tsx` |
| Admin guard | `src/components/admin/AdminLayout.tsx` |
| Admin nav | `src/components/admin/AdminSidebar.tsx` |
| Main nav | `src/components/layout/Navbar.tsx` |
| Borrower dashboard | `src/pages/Dashboard.tsx` |
| Borrower apply | `src/pages/Apply.tsx` |
| Borrower profile | `src/pages/Profile.tsx` |
| Admin borrowers | `src/pages/admin/AdminBorrowers.tsx` |
| Admin applications | `src/pages/admin/AdminApplications.tsx` |
| Admin dashboard | `src/pages/admin/AdminDashboard.tsx` |
| Disbursements | `src/pages/admin/AdminDisbursements.tsx` |
| Loan products | `src/pages/admin/AdminLoanProducts.tsx` |

---

*End of audit.*
