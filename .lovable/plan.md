

## Current State and Remaining Gaps

Based on reviewing your codebase, documentation, console logs, and the 6 fixes just implemented, here is a prioritized breakdown of what remains.

---

### Recently Completed (Just Done)
1. Loan officer blocked from disbursing
2. Reloan feature (admin-only)
3. Document matching fix
4. Duplicate active loan prevention
5. Receipt branding (Phindu burgundy)
6. Director signature removed from contracts

---

### Immediate Bugs to Fix

| Issue | Severity | Details |
|-------|----------|---------|
| Expired auth session handling | Medium | Console shows `Refresh Token Not Found` errors -- users see a blank state instead of being redirected to login cleanly |
| AdminRoute ref warning | Low | `Navigate` component given a ref it can't accept -- cosmetic React warning |

---

### High-Priority Gaps (Business Impact)

**1. Pagination and Performance**
- Several admin pages (Loans, Repayments, Borrowers) fetch all records without server-side pagination
- Will degrade as loan book grows past 200-300 records
- Hit the 1000-row Supabase default limit

**2. Real-time Updates Inconsistency**
- `AdminApplications` has real-time subscriptions but other pages (Repayments, Disbursements, Collections) require manual refresh
- Loan officers and admins see stale data until page reload

**3. Document Management Per Product**
- Product-level `required_documents` JSONB exists but the matching between uploaded docs and required docs is fragile (just patched with aliases)
- No admin UI to configure which documents are required per product -- it's manual JSONB editing
- No document review workflow (approve/reject individual docs with comments)

**4. Notification Reliability**
- Notifications are sent from the application layer -- if the request fails, they're lost
- No retry logic or queue processing for failed SMS/email
- The `process-notification-queue` edge function exists but isn't wired to a cron trigger

---

### Medium-Priority Gaps

**5. Loan Product Engine Enhancements**
- Fees are percentage-only (no fixed amounts like "K50 CRB fee")
- No option to deduct fees upfront vs add to repayment (currently hardcoded upfront)
- No calculation preview when creating/editing products in admin
- No loan category field (Personal, SME, Salary-Based)

**6. Approval Workflow Configuration**
- Fixed status pipeline -- no per-product configurable stages
- No role-based permissions per workflow stage (e.g., "only credit officer can move from CRB check to approved")
- No automated triggers (auto-move to next stage, auto-send notification)

**7. Collections Module Gaps**
- Collection assignments exist but no automated escalation rules
- No "Promise to Pay" tracking with follow-up reminders
- No integration between collections and court cases workflow

**8. Reporting Enhancements**
- Dashboard charts use some hardcoded data
- No scheduled/automated report generation
- PAR (Portfolio at Risk) metrics could be more granular (PAR 1, 7, 30, 60, 90)

---

### Lower-Priority / Nice-to-Have

| Feature | Status |
|---------|--------|
| Formula builder for custom loan calculations | Not started |
| CRB API live integration | Toggle-ready, no live API |
| PMIC insurance live integration | UI exists, no live connection |
| Bulk SMS/email campaigns | Not implemented |
| Borrower self-service portal improvements | Basic -- no payment initiation |
| Mobile PWA polish | Service worker exists, UX needs work |
| Advanced audit trail UI (diff view) | Logs exist, no comparison view |

---

### Recommended Next Steps (Priority Order)

1. **Fix auth session expiry handling** -- users hitting blank screens
2. **Add server-side pagination** to AdminLoans, AdminRepayments, AdminBorrowers
3. **Add real-time subscriptions** to Repayments and Disbursements pages
4. **Build document configuration UI** in loan product form (manage required docs per product)
5. **Wire notification queue** to a scheduled cron for reliable delivery

These 5 items would take the system from "functional" to "production-robust" and address the most common operational pain points.

