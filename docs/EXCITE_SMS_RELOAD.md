# ExciteSMS reload (production)

Borrower/staff SMS uses **ExciteSMS** via edge functions (`send-otp`, `send-notification`, `process-notification-queue`, `excite-sms`).

## 1. Supabase / Lovable secrets (preferred)

Set in **Edge Functions → Secrets**:

| Secret | Example |
|--------|---------|
| `EXCITESMS_API_TOKEN` | Token from Excite dashboard (no `Bearer` prefix) |
| `EXCITESMS_SENDER_ID` | Approved sender, e.g. `Phindu` |
| `EXCITESMS_API_URL` | `https://gateway.excitesms.com/api/v3` |

Secrets override stale values in Admin Settings UI.

## 2. Admin Settings (optional mirror)

**Settings → Notifications:** SMS provider = ExciteSMS; paste same token/sender if not using secrets-only.

## 3. Redeploy functions

Redeploy at least: `send-otp`, `send-notification`, `process-notification-queue`, `excite-sms`.

## 4. Queue cron

Ensure **`process-notification-queue`** runs on a schedule (Lovable Cloud → Functions → Schedules).

## 5. Verify

- Send OTP from borrower auth.
- Check `notification_logs` / queue for `failed` rows and provider response.
- Supabase → Edge Functions → Logs for `excitesms` / `401` / `535`.
