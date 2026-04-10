# QA and production sign-off checklist

Use this before calling the ERP/LMS release **fully done**.

## Environment

- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` set for staging/production.
- [ ] Optional: `VITE_API_URL` points to deployed **apps/api-next** (default local dev: `http://localhost:3001`).
- [ ] Optional: `VITE_API_PHASE1_WORKFLOW=true` when api-next is live so loan transitions and payment claims use the API layer.
- [ ] Supabase migrations applied through **`20260410120000_restore_transition_loan_status_full.sql`** (restores full `transition_loan_status` workflow).

## API (apps/api-next)

With a staff JWT (`Authorization: Bearer <access_token>`):

- [ ] `GET /api/v1/health`
- [ ] `POST /api/v1/loans/:id/transitions` with body `{ "toStatus": "<valid next status>" }`
- [ ] `GET /api/v1/loans/:id/events`
- [ ] `POST /api/v1/repayments/:repaymentId/payment-claims` (borrower token)
- [ ] `GET /api/v1/admin/payment-claims` (staff)
- [ ] `POST /api/v1/payment-claims/:id/review` (staff)
- [ ] `GET /api/v1/notifications/me` and `POST /api/v1/notifications/:id/read`

## Notifications (operations)

- [ ] SMS/WhatsApp/email provider credentials in **system_settings** / notification providers UI.
- [ ] WhatsApp Business / provider approval completed for production sender.
- [ ] Monitor **notification_logs** and provider dashboards for failures.

## Borrower mobile (Capacitor)

- [ ] `npm run build` then `npx cap sync` (Android / iOS).
- [ ] Production builds **omit** `CAPACITOR_SERVER_URL` so the app loads bundled `dist/` (set only for LAN dev against Vite).
- [ ] Store listings, icons, splash, and deep links verified on real devices.

## Regression (manual)

- [ ] Borrower: apply → KYC → dashboard; payment claim submit; profile tabs.
- [ ] Staff: document verify → finance approve → approve → contract → disburse → repayment/claim review.
- [ ] Payroll: view-only vs **manage** (generate/approve/pay) matches `payroll:view` / `payroll:manage`.
- [ ] Non–super_admin staff: only routes allowed by **permissions** (not blanket admin bypass).
