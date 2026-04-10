# send-web-push

Sends a **Web Push** payload to every row in `push_subscriptions` for a given `user_id`.

## Auth

Same pattern as `process-notification-queue`: call with header:

`Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`

Do **not** expose the service role key in client apps. Invoke from Supabase cron, database webhooks, or trusted backend jobs only.

## Secrets (Supabase project)

Set these for the function (Dashboard → Edge Functions → Secrets, or CLI):

| Secret | Description |
|--------|-------------|
| `VAPID_PUBLIC_KEY` | Must match `VITE_VAPID_PUBLIC_KEY` on the frontend |
| `VAPID_PRIVATE_KEY` | Private key (never put in Vite env) |
| `VAPID_SUBJECT` | Optional `mailto:you@domain` contact for push providers |

Generate keys (Node):

```bash
npx web-push generate-vapid-keys
```

## Request body

```json
{
  "user_id": "<uuid>",
  "title": "Payment received",
  "body": "Your repayment was recorded.",
  "url": "/dashboard"
}
```

## Database

The project already includes `push_subscriptions` (see `supabase/migrations/20260108171013_68fb6947-6cc4-4eb3-8e58-7d2d0511db79.sql`). No extra migration is required for this function.

## Example invoke (curl)

```bash
curl -X POST "$SUPABASE_URL/functions/v1/send-web-push" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"YOUR_USER_UUID","title":"Test","body":"Hello from Web Push"}'
```
