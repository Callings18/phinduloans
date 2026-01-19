# Respond.io WhatsApp Business Integration

This document explains how to use Respond.io for sending WhatsApp Business template messages to borrowers.

## Overview

Respond.io is integrated as a WhatsApp provider in the Phindu Loans notification system. It allows you to send WhatsApp template messages (approved by WhatsApp Business) to borrowers for various loan-related events.

## Prerequisites

1. **Respond.io Account**: Sign up at [respond.io](https://respond.io)
2. **WhatsApp Business Number**: Your WhatsApp Business number must be connected to Respond.io as a channel
3. **WhatsApp Templates**: Create and get approval for WhatsApp message templates in WhatsApp Business Manager

## Configuration

### Step 1: Get Respond.io Credentials

1. Log in to your Respond.io account
2. Go to **Settings** → **API**
3. Generate or copy your **API Key**
4. Go to **Channels** → **WhatsApp**
5. Find your WhatsApp channel and copy the **Channel ID**

### Step 2: Configure in Phindu Loans

1. Navigate to **Admin Settings** → **Integrations** → **Notification Providers**
2. Go to the **WhatsApp** tab
3. Enable WhatsApp notifications
4. Select **Respond.io** as the WhatsApp provider
5. Enter your credentials:
   - **API Key**: Your Respond.io API key
   - **Base URL**: `https://api.respond.io/v3` (default)
   - **WhatsApp Channel ID**: Your WhatsApp channel ID from Respond.io
6. Click **Test WhatsApp Connection** to verify
7. Save settings

## WhatsApp Template Messages

Respond.io requires WhatsApp template messages (approved by WhatsApp Business Manager) for outbound messages. You cannot send free-form messages to users who haven't initiated a conversation.

### Creating Templates

1. Go to **WhatsApp Business Manager**
2. Navigate to **Message Templates**
3. Create templates for different notification types:
   - `loan_due_soon` - Payment reminder
   - `loan_created` - New loan notification
   - `payment_received` - Payment confirmation
   - `loan_overdue` - Overdue notice
   - `loan_approved` - Loan approval notification

### Template Format Example

**Template Name**: `loan_due_soon`

**Template Content**:
```
Hello {{1}}, 

This is a reminder that your loan payment of {{2}} is due on {{3}}.

Please ensure payment is made on time to avoid penalties.

Thank you,
Phindu Finance
```

**Parameters**:
- `{{1}}` - Borrower name
- `{{2}}` - Amount (e.g., K5,000.00)
- `{{3}}` - Due date (e.g., January 20, 2026)

## Usage

### Sending Template Messages via Edge Function

#### Example 1: Payment Due Soon Notification

**Edge Function**: `send-due-soon-notification`

**Request**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-due-soon-notification \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "loan_id": "uuid-of-loan"
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "WhatsApp notification sent successfully",
  "loan": {
    "id": "uuid-of-loan",
    "borrower_name": "John Doe",
    "amount": 5000,
    "due_date": "2026-01-20"
  },
  "result": {
    "success": true,
    "messageId": "msg-id-from-respondio"
  }
}
```

#### Example 2: Custom Template Message

**Edge Function**: `send-notification`

**Request**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-notification \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "whatsapp",
    "provider": "respondio",
    "to": "+260971234567",
    "message": "Fallback message if template fails",
    "templateName": "loan_due_soon",
    "templateLanguage": "en",
    "templateComponents": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "John Doe" },
          { "type": "text", "text": "K5,000.00" },
          { "type": "text", "text": "January 20, 2026" }
        ]
      }
    ]
  }'
```

### Using the Helper Function (TypeScript)

```typescript
import { 
  sendRespondIOTemplate, 
  createTextParameter,
  formatDateForTemplate,
  formatCurrencyForTemplate 
} from '@/utils/respondioHelper';

// Send a payment due soon notification
const result = await sendRespondIOTemplate(
  {
    phone: '+260971234567',
    templateName: 'loan_due_soon',
    languageCode: 'en',
    components: [
      {
        type: 'body',
        parameters: [
          createTextParameter('John Doe'),
          createTextParameter(formatCurrencyForTemplate(5000)),
          createTextParameter(formatDateForTemplate('2026-01-20')),
        ],
      },
    ],
  },
  {
    apiKey: 'your-api-key',
    channelId: 'your-channel-id',
    baseUrl: 'https://api.respond.io/v3', // Optional, defaults to this
  }
);
```

## Available Edge Functions

### 1. `send-due-soon-notification`

Sends a payment reminder WhatsApp template message for a specific loan.

**Endpoint**: `POST /functions/v1/send-due-soon-notification`

**Request Body**:
```json
{
  "loan_id": "uuid-of-loan",
  "templateName": "loan_due_soon",  // Optional, defaults to "loan_due_soon"
  "languageCode": "en"               // Optional, defaults to "en"
}
```

**Behavior**:
- Fetches loan data from `loan_applications` table
- Validates loan status is 'active'
- Gets the next due repayment
- Sends WhatsApp template message via Respond.io
- Logs notification to `notification_logs` table

### 2. `send-notification` (Generic)

Generic notification function that supports Respond.io template messages.

**Endpoint**: `POST /functions/v1/send-notification`

**Request Body** (for Respond.io):
```json
{
  "type": "whatsapp",
  "provider": "respondio",
  "to": "+260971234567",
  "message": "Fallback message",
  "templateName": "loan_due_soon",
  "templateLanguage": "en",
  "templateComponents": [
    {
      "type": "body",
      "parameters": [
        { "type": "text", "text": "John Doe" },
        { "type": "text", "text": "K5,000.00" },
        { "type": "text", "text": "January 20, 2026" }
      ]
    }
  ]
}
```

## Template Component Types

### Text Parameters
```typescript
{ type: 'text', text: 'John Doe' }
```

### Currency Parameters
```typescript
{
  type: 'currency',
  currency: {
    fallback_value: 'ZMW 5000.00',
    code: 'ZMW',
    amount_1000: 5000000  // Amount in smallest currency unit (1000 = 1 ZMW)
  }
}
```

### Date/Time Parameters
```typescript
{
  type: 'date_time',
  date_time: {
    fallback_value: '2026-01-20T00:00:00Z'
  }
}
```

## Helper Functions

The `respondioHelper.ts` file provides utility functions:

- `sendRespondIOTemplate()` - Main function to send template messages
- `createTextParameter()` - Helper for text parameters
- `createCurrencyParameter()` - Helper for currency parameters
- `createDateTimeParameter()` - Helper for date/time parameters
- `formatDateForTemplate()` - Format date for readable display
- `formatCurrencyForTemplate()` - Format currency for readable display

## Error Handling

The integration includes comprehensive error handling:

- **Missing Credentials**: Returns error if API key or channel ID not configured
- **Invalid Phone Number**: Validates and formats phone numbers to E.164 format
- **Template Not Found**: Returns error if template name doesn't exist in Respond.io
- **API Errors**: Logs and returns detailed error messages from Respond.io API

## Testing

### Test Connection

Use the "Test WhatsApp Connection" button in Admin Settings to verify your Respond.io configuration.

### Test Template Message

```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-notification \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "whatsapp",
    "provider": "respondio",
    "to": "+260971234567",
    "message": "Test message",
    "templateName": "loan_due_soon",
    "templateLanguage": "en",
    "templateComponents": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Test User" },
          { "type": "text", "text": "K1,000.00" },
          { "type": "text", "text": "January 25, 2026" }
        ]
      }
    ]
  }'
```

## Notification Logs

All WhatsApp messages sent via Respond.io are logged in the `notification_logs` table with:
- Recipient phone number
- Template name used
- Status (sent/failed)
- Provider response
- Timestamp

View logs in **Admin** → **Reports** → **Notification Logs**

## Troubleshooting

### "Respond.io credentials not configured"
- Ensure API key and channel ID are entered in Admin Settings
- Verify settings are saved

### "Template name is required"
- Always provide `templateName` when using Respond.io
- Ensure template is approved in WhatsApp Business Manager

### "Respond.io API error"
- Check API key is valid
- Verify channel ID matches your WhatsApp channel in Respond.io
- Ensure WhatsApp Business number is connected to Respond.io

### "Loan not found or not active"
- Verify loan exists in database
- Check loan status is 'active'
- Ensure loan has a due repayment

## Best Practices

1. **Template Approval**: Get templates approved in WhatsApp Business Manager before using
2. **Parameter Validation**: Always validate template parameters match template structure
3. **Error Handling**: Implement retry logic for failed messages
4. **Rate Limiting**: Respect WhatsApp rate limits (check Respond.io documentation)
5. **Testing**: Test templates with your own number before sending to borrowers
6. **Logging**: Monitor notification logs for delivery issues

## Support

- **Respond.io Documentation**: https://docs.respond.io/
- **WhatsApp Business API**: https://developers.facebook.com/docs/whatsapp
- **Template Guidelines**: https://developers.facebook.com/docs/whatsapp/message-templates

## Files

- `src/utils/respondioHelper.ts` - Helper functions for Respond.io
- `supabase/functions/send-notification/index.ts` - Main notification function (includes Respond.io support)
- `supabase/functions/send-due-soon-notification/index.ts` - Payment reminder function
- `src/components/admin/NotificationProvidersSettings.tsx` - Admin UI for configuration
