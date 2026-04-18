# Phindu LMS — Production Launch Checklist

> Run top-to-bottom on launch day. Every item must be checked off.

---

## T-7 days — environment & data hygiene

- [ ] All migrations applied to production (run `supabase db diff` — must be empty)
- [ ] `system_settings.companyInfo` populated with real Phindu phone, email, address (no placeholder `XXX`)
- [ ] At least one **active funding account** exists in `accounts` table with a real opening balance
- [ ] At least one **loan product** per offering is `is_active = true` with correct interest, fees, term
- [ ] Contract templates uploaded for each product with `is_active = true`
- [ ] Test borrower / staff users **deleted** or clearly marked
- [ ] `audit_logs` retention policy documented (currently unlimited; OK for year 1)
- [ ] Storage buckets `loan-documents` and `contracts` policies verified (private + signed URL access)

## T-3 days — secrets & integrations

- [ ] `EXCITE_SMS_*` secret confirmed live (send test SMS via admin)
- [ ] `BREVO_API_KEY` confirmed live (send test email)
- [ ] WhatsApp `TWILIO_*` confirmed (or feature-flagged off)
- [ ] `LENCO_API_KEY` (if disbursing via gateway) confirmed
- [ ] CRB provider key confirmed OR CRB step disabled
- [ ] Web push `VAPID_*` keys present (PWA install prompt works)
- [ ] Cron schedule for `payment-reminder-cron` set: 08:00, 13:00, 17:00 CAT
- [ ] Cron schedule for `process-notification-queue` set: every 5 min

## T-1 day — final smoke test in staging-like env

- [ ] Run **all** of `docs/QA_LAUNCH_TEST_SHEET.md` sections A–F
- [ ] Run all 8 edge cases in section G
- [ ] Lighthouse audit on borrower dashboard ≥ 80 on Performance, Accessibility, SEO
- [ ] PWA installable on Android Chrome and iOS Safari
- [ ] Capacitor APK builds and runs on a physical Android device

## Launch day (T-0)

- [ ] Backup database (Supabase auto-backups OK; confirm last successful backup ≤ 24h)
- [ ] Tag release in code: `v1.0.0-launch`
- [ ] Announce maintenance window if applicable
- [ ] Switch DNS / publish app
- [ ] **Post-launch sanity in first 30 min**:
  - [ ] Submit one real test application end-to-end (delete after)
  - [ ] Verify SMS arrives within 2 min
  - [ ] Verify email arrives within 2 min
  - [ ] Verify a real disbursement debits the funding account
- [ ] Notify client of go-live

## Day 1 monitoring

Open these queries every 2 hours for the first day:

```sql
-- Failed disbursements
select id, amount, status, created_at, transaction_reference
from disbursements
where status = 'failed' and created_at >= now() - interval '24 hours';

-- Failed notifications
select type, recipient, status, error_message, created_at
from notification_logs
where status = 'failed' and created_at >= now() - interval '24 hours'
order by created_at desc limit 50;

-- Stuck pending notifications (older than 30 min)
select count(*) from notification_logs
where status = 'pending' and created_at < now() - interval '30 minutes';

-- Loans stuck in awaiting_disbursement > 24h
select id, full_name, loan_amount, updated_at
from loan_applications
where status = 'awaiting_disbursement' and updated_at < now() - interval '24 hours';

-- High-value audit events
select user_id, action, entity_type, created_at, new_values
from audit_logs
where action in (
  'DISBURSEMENT_COMPLETED','WRITEOFF_APPROVED','MOVE_TO_DEFAULTED',
  'STATUS_TRANSITION','PAYMENT_RECORDED'
) and created_at >= now() - interval '24 hours'
order by created_at desc;
```

## Rollback plan

If a critical bug appears within the first 24h:

1. **Revert Lovable to last known-good version** (Lovable git history → "Restore to this version").
2. If a DB migration is the cause, restore the latest Supabase backup (Supabase dashboard → Database → Backups). Database changes are forward-only via Lovable.
3. Notify client immediately. Communicate ETA for re-deploy.
4. Disable any partly-launched feature with a feature flag in `src/config/featureRollout.ts` rather than rolling back the whole app where possible.

## Known limitations at launch (disclose to client)

- Wallets module is hidden until built out
- Custom workflow configuration is read-only (standard pipeline only)
- WhatsApp delivery requires recipient opt-in via Twilio sandbox keyword `join`
- No automated test suite — depends on the QA Test Sheet for regression
- No staging environment — fixes deploy directly to production

## Sign-off

| Name | Role | Date |
|---|---|---|
|  | Client lead |  |
|  | Phindu PM |  |
|  | Lead developer |  |
