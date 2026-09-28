# Pilot go-live — status as of 28 Sep 2026

Office and borrower frontends are deployed from `main` `9267a29`. This is the remaining operator step plus the smoke test.

## Live check (done)

| Host | Result |
|------|--------|
| https://office.phindu.com/auth | Staff **email + password**. Unauthenticated `/admin` returns to `/auth?next=/admin` (no borrower bounce). |
| Cloudflare **phinduloans-staff-web** | Build success on `9267a29` (`npm run build:staff`). |
| https://app.phindu.com/auth | Borrower **SMS OTP**. Copy says **Download Our App**. |
| Cloudflare **phinduloans-borrower** | Build success on `9267a29`. |
| Borrower env | `VITE_API_LOAN_PRODUCTS=false`, `VITE_API_PHASE1_WORKFLOW=false` (direct Supabase — correct until an API is hosted). |
| AI modules | Routes and nav removed from staff-web. Development marquee removed; Pilot badge is on the dashboard (login required). |

## Do this once (required — not done from here)

Open the **Supabase SQL Editor** for project `yqrfheavftgybhcafzpt` and run the full file:

`supabase/migrations/20260928120000_borrower_portal_admin_visibility_fixes.sql`

It fixes:

1. Borrower contract sign → status **awaiting_disbursement** (trigger was blocking it)
2. Self-service apply can add the borrower to the **product house roster**
3. Finance / collections can **see and verify application documents**
4. Borrower can resubmit a claim after **needs_more_info**

If a statement says the policy already exists, that part is already applied — continue.

## Staff accounts

Anyone who signs in on office and sees “no staff role” is not in `user_roles`. A super admin must add `admin` (or the real role) before they can open `/admin`.

## Smoke test (15 min, after SQL)

1. Borrower: OTP login → apply → products appear → upload a doc → submit.
2. Office: application appears with documents (loan officer **and** finance).
3. Approve → borrower signs contract → status **awaiting_disbursement**.
4. Borrower: payment claim **with a receipt photo** → office sees **pending_review** → verify and record.
5. Office dashboard: no “under development” banner; no AI Agents menu.

## Do not

- Set `VITE_API_LOAN_PRODUCTS` or `VITE_API_PHASE1_WORKFLOW` to `true` until api-next is actually deployed.
- Deploy the old root `src/` admin app. Use **apps/staff-web** only.
