# Deep Audit Plan — Phindu LMS/ERP

## Goal
Produce a single comprehensive audit report (markdown + PDF) covering gaps, bugs, dead code, broken/idle buttons, and security/RLS issues across the four focus areas. **No code changes** — read-only analysis.

## Deliverable
`/mnt/documents/PHINDU_DEEP_AUDIT_2026-05-22.md` (and `.pdf` version) containing:

1. **Executive summary** — overall health score, top 10 risks, quick-win count.
2. **Borrower flow audit**
   - `/apply` wizard: auth gating, draft persistence, document key mismatches (`selfie` vs `selfie_holding_nrc`), validation gaps, dead buttons.
   - `/dashboard`: widget data freshness, broken links (`PaymentReminder` target), realtime subscription correctness, payment-claim UX.
   - `/profile`: deep-link tab handling, doc vault consistency, notification preference persistence.
   - Payment claim submission path (UI → repository → API → DB).
3. **Admin loan lifecycle audit**
   - Applications → Approval → Contract Signing → Disbursement → Repayment.
   - Direct Supabase writes vs `apps/api-next` transition endpoint (drift).
   - Bypass risks in `AdminApplications.tsx` / `AdminDisbursements.tsx`.
   - Repayments & bulk repayments idempotency and atomic RPC usage.
   - Buttons/actions that look active but are no-ops or unguarded.
4. **Product house audit** (Salary Advance, Marketeer, Payday, Business, Collateral, Reloan, Top-up, Restructure)
   - Schedule generation per frequency (recent Payday-as-daily regression).
   - 1000-row pagination caps in trackers (recent Marketeer fix — verify others).
   - Fee/penalty/interest math vs `calculateLoan()` and DB triggers.
   - House-scoped permissions (`useProductAccess`).
5. **Security, RLS & permissions audit**
   - `supabase--linter` results.
   - RLS coverage per table (esp. `payment_claims`, `loan_repayments`, `disbursements`, `profiles`, `user_roles`, KYC storage).
   - Edge function JWT verification (`verify_jwt`) and service-role misuse.
   - Fail-open behavior in `usePermissions`, `AdminRoute`, `PermissionRoute`.
   - Secret exposure in client code; storage bucket policies (signed URL enforcement).
6. **Dead / idle code inventory**
   - Unused components, exported-but-never-imported utilities, stale migrations, orphaned edge functions, duplicate logic (e.g. multiple repayment calculators), obsolete docs.
   - Legacy backend (`backend/` NestJS) vs `apps/api-next` overlap.
7. **Database hygiene**
   - Orphaned rows after recent Salary Advance purge.
   - Trigger conflicts (22+ triggers — overlapping status writers).
   - Indexes missing on hot query paths.
8. **Prioritized findings table** — every finding tagged `P0/P1/P2/Cleanup` with file paths and one-line repro/fix hint. **No code written** — just the report.

## Method
- `rg` sweeps for: `TODO`, `FIXME`, `console.log`, `// @ts-ignore`, `as any`, disabled buttons, `onClick={() => {}}`, dead routes, unused exports.
- `code--view` on every flagged file to confirm.
- `supabase--linter` + targeted `supabase--read_query` for RLS coverage, orphan rows, trigger list.
- Cross-reference recent fix history (Payday, Marketeer, Twiza reloan, Salary Advance reset) for regressions.
- `ts-prune`-style scan via `rg` for unimported exports.
- Edge-function inventory: each function checked for `verify_jwt`, auth header validation, rate limiting.

## Out of scope
- Performance profiling under load.
- Penetration testing.
- Mobile (Capacitor) build-specific issues unless code-visible.
- Any file edits or migrations — report only.

## Time/size expectation
Report ~30–60 pages, ~80–150 itemized findings. Generated in one pass; no follow-up needed unless you ask for fixes.
