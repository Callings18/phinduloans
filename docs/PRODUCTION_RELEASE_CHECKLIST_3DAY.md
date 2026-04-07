# PHINDU 3-Day Production Release Checklist

## 1) Pre-Release Configuration
- Confirm `system_settings.notification_providers` has active channel flags and valid provider credentials.
- Confirm `system_settings.integrations.lms_mode` is set to `internal_only` for this release.
- Apply latest DB migrations, including `20260406130000_workflow_transition_guards.sql`.
- Verify service-role secrets are present for Supabase Edge functions.

## 2) Critical Flow Smoke Tests
- Borrower can open and submit a new application from dashboard even with an existing active loan.
- Admin can filter applications by `crb_failed` and `pmic_pending`.
- Approval flow uses workflow transitions (`verify_documents` -> `finance_approve` -> `approve`) and rejects invalid transitions.
- Disbursement creates `pending` then transitions to `completed`; loan moves to `disbursed`.
- Payroll run transitions only `draft -> approved -> paid`.

## 3) Notification Reliability
- SMS path: verify selected primary provider works.
- Fallback path: force primary SMS failure and confirm Twilio fallback sends.
- Email path: verify SendGrid delivery with subject/body.
- WhatsApp path: verify Twilio WhatsApp delivery if enabled.

## 4) Mobile and Realtime
- Borrower dashboard realtime updates trigger after loan status changes.
- Notification dropdown continues to receive and show realtime notification rows.
- Push subscription prompt remains disabled until backend subscription storage is production-ready.

## 5) Rollback Plan
- Keep previous deployment artifact available for immediate redeploy.
- If workflow transitions block valid operations, rollback only migration `20260406130000_workflow_transition_guards.sql`.
- If notification failures spike, set channel flags off in `notification_providers` and continue core loan operations.
- If borrower flow regressions are found, revert hidden-feature UI toggles in dashboard components first.

## 6) Post-Release Monitoring (same day)
- Monitor `notification_logs` send/fail ratios by channel.
- Monitor disbursement status counts and failed transition exceptions.
- Monitor approval/disbursement/payroll audit log events for expected sequence.
- Collect first-hour borrower feedback on apply/pay/sign journeys.
