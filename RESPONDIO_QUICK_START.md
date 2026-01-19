# Respond.io Integration - Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Get Respond.io Credentials

1. Log in to [Respond.io](https://respond.io)
2. Go to **Settings** → **API** → Copy your **API Key**
3. Go to **Channels** → **WhatsApp** → Copy your **Channel ID**

### 2. Configure in Phindu Loans

1. Go to **Admin Settings** → **Integrations** → **Notification Providers**
2. Click **WhatsApp** tab
3. Enable WhatsApp notifications
4. Select **Respond.io** as provider
5. Enter:
   - **API Key**: Your Respond.io API key
   - **Base URL**: `https://api.respond.io/v3` (default)
   - **Channel ID**: Your WhatsApp channel ID
6. Click **Test Connection**
7. **Save**

### 3. Create WhatsApp Templates

In **WhatsApp Business Manager**, create and approve templates:

**Template Name**: `loan_due_soon`
```
Hello {{1}},

Your payment of {{2}} is due on {{3}}.

Thank you,
Phindu Finance
```

Parameters:
- `{{1}}` = Borrower name
- `{{2}}` = Amount (e.g., K5,000.00)
- `{{3}}` = Due date (e.g., January 20, 2026)

## 📤 Send Payment Reminder

### Via Edge Function (Recommended)

```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-due-soon-notification \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "loan_id": "uuid-of-loan"
  }'
```

### Via Code (TypeScript)

```typescript
import { supabase } from '@/integrations/supabase/client';

const { data, error } = await supabase.functions.invoke('send-due-soon-notification', {
  body: { loan_id: 'uuid-of-loan' }
});
```

## ✅ What Happens

1. System fetches loan data
2. Validates loan is active
3. Gets next due payment
4. Sends WhatsApp template via Respond.io
5. Logs notification

## 📋 Example Response

```json
{
  "success": true,
  "message": "WhatsApp notification sent successfully",
  "loan": {
    "id": "uuid",
    "borrower_name": "John Doe",
    "amount": 5000,
    "due_date": "2026-01-20"
  }
}
```

## 🔧 Troubleshooting

**"Credentials not configured"**
→ Check API key and channel ID in Admin Settings

**"Template name is required"**
→ Always provide templateName for Respond.io

**"Loan not found"**
→ Verify loan exists and status is 'active'

## 📚 Full Documentation

See `RESPONDIO_INTEGRATION.md` for complete documentation.
