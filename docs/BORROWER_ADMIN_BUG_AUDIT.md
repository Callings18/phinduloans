# Borrower ↔ admin bug audit (summary)

Last reviewed: 2026-09-28. Fixes in code + migration `20260928120000_borrower_portal_admin_visibility_fixes.sql`.

## Fixed in repo (deploy + run SQL on Lovable)

| Issue | Impact | Fix |
|-------|--------|-----|
| Contract sign → `awaiting_disbursement` blocked by trigger | Borrower stuck after signing; admin sees no progress | Migration: allow that status transition |
| Payment receipt upload path | Claims with receipt fail upload | Dashboard: `{userId}/payment-receipts/...` |
| Payment claim review without API | Admin verify fails when `VITE_API_PHASE1_WORKFLOW=false` | `reviewPaymentClaim` Supabase update fallback |
| House roster missing portal borrowers | Admin house “Borrowers” empty | Migration: borrower INSERT on `product_house_borrowers` |
| Finance/collections cannot see app docs | Empty documents tab | Migration: extend application_documents RLS |
| Empty product list / profile errors | Apply appears broken | UI alerts + `mobile_app` channel filter |

## Additional fixes (same deploy wave)

| Issue | Fix |
|-------|-----|
| Duplicate “I've paid” while claim pending | `canSubmitNewPaymentClaim` + pre-insert check |
| Contract sign two-step status update | Single update sets `awaiting_disbursement` |
| Auth redirect before roles load | `rolesResolved` / `rolesError` on Auth page |
| QuickApply admin-only products | `isBorrowerPortalProduct` filter |
| `needs_more_info` claim — no resubmit button | Update same claim → `pending_review`; RLS policy + “Send updated info” |
| My Loans tab duplicate “I've paid” | Claim status guard (same as Payments tab) |
| Admin misses `needs_more_info` claims | `fetchAdminOpenPaymentClaims` on Repayments |

## Still verify in production config

- **`VITE_API_LOAN_PRODUCTS=true`** without live API → apply shows no products. Keep **`false`** unless api-next is deployed.
- **`VITE_API_PHASE1_WORKFLOW=true`** without API → claim **submit** may fail; review now works via Supabase when false.
- **Staff on app.phindu.com** → redirected to office (by design). Use borrower test account for UAT.
- **Legacy root `src/` admin** → do not deploy; use **`apps/staff-web`** only (`pending_review` claims already correct there).
- **Duplicate open payment claim** on same installment → DB unique index; UI should show existing claim.

## Smoke test after SQL + deploy

1. Borrower OTP login → apply → upload doc → submit.
2. Admin: application + documents visible (loan officer + finance).
3. Approve → borrower signs contract → status **awaiting_disbursement**.
4. Borrower payment claim **with receipt photo** → admin sees **pending_review** → verify & record.
