# Notification Providers Setup Guide

This guide explains how to configure multi-channel notifications (SMS, WhatsApp, and Email) for your Phindu Loans application.

## Overview

The notification system supports multiple providers for different communication channels:

- **SMS**: Africa's Talking, Twilio
- **WhatsApp**: Africa's Talking, Twilio  
- **Email**: SendGrid, SMTP

## Features

- ✅ Multi-provider support with easy switching
- ✅ Multi-channel notifications (SMS + Email + WhatsApp simultaneously)
- ✅ Event-based notification preferences
- ✅ Notification logging and tracking
- ✅ Provider testing before going live
- ✅ Fallback support

## Supported Notification Events

The system can send notifications for the following events:

1. **Sign Up Welcome** - Welcome message when borrower creates account
2. **Loan Approval** - Notify when loan application is approved
3. **Loan Rejection** - Notify when loan application is rejected
4. **Loan Disbursement** - Notify when funds are disbursed
5. **Payment Received** - Confirm receipt of loan payments
6. **Payment Reminders** - Remind borrowers of upcoming payments
7. **Overdue Notices** - Alert borrowers of overdue payments
8. **Loan Completion** - Congratulate borrowers on full repayment

## Configuration

### 1. Africa's Talking Setup

#### SMS Configuration

1. Create an account at [africastalking.com](https://africastalking.com)
2. Go to your dashboard and navigate to "SMS" section
3. Get your credentials:
   - **Username**: Found in your account settings (use "sandbox" for testing)
   - **API Key**: Generate from the API Key section
   - **Sender ID**: Register a sender ID or use default

4. In Phindu Loans Admin Settings:
   - Navigate to **Settings** → **Integrations** → **Notification Providers** → **SMS**
   - Enable SMS Notifications
   - Select "Africa's Talking" as provider
   - Enter your credentials
   - Test the connection

#### WhatsApp Configuration

1. In your Africa's Talking dashboard, apply for WhatsApp Business API access
2. Once approved, get your WhatsApp number
3. In Phindu Loans Admin Settings:
   - Navigate to **Settings** → **Integrations** → **Notification Providers** → **WhatsApp**
   - Enable WhatsApp Notifications
   - Select "Africa's Talking" as provider
   - Enter your WhatsApp business number (format: +260123456789)
   - Test the connection

**Cost**: Pay-as-you-go pricing. Check their website for current rates.

---

### 2. Twilio Setup

#### SMS Configuration

1. Create an account at [twilio.com](https://www.twilio.com)
2. From your Twilio Console:
   - Get your **Account SID** (starts with "AC...")
   - Get your **Auth Token** (click to reveal)
   - Buy a phone number or use your existing number

3. In Phindu Loans Admin Settings:
   - Navigate to **Settings** → **Integrations** → **Notification Providers** → **SMS**
   - Enable SMS Notifications
   - Select "Twilio" as provider
   - Enter Account SID, Auth Token, and Phone Number
   - Test the connection

#### WhatsApp Configuration

1. In Twilio Console, navigate to Messaging → WhatsApp
2. Set up WhatsApp sandbox for testing or apply for WhatsApp Business API
3. Get your WhatsApp-enabled number (format: whatsapp:+14155238886)
4. In Phindu Loans Admin Settings:
   - Navigate to **Settings** → **Integrations** → **Notification Providers** → **WhatsApp**
   - Enable WhatsApp Notifications
   - Select "Twilio" as provider
   - Enter your WhatsApp number with the "whatsapp:" prefix
   - Test the connection

**Cost**: Pay-as-you-go pricing. Free trial credits available. Check their website for current rates.

---

### 3. SendGrid Email Setup

1. Create an account at [sendgrid.com](https://sendgrid.com)
2. From your SendGrid Dashboard:
   - Navigate to Settings → API Keys
   - Create a new API Key with "Mail Send" permission
   - Copy the API Key (shown only once)

3. Verify your sender email:
   - Go to Settings → Sender Authentication
   - Verify a single sender or set up domain authentication

4. In Phindu Loans Admin Settings:
   - Navigate to **Settings** → **Integrations** → **Notification Providers** → **Email**
   - Enable Email Notifications
   - Select "SendGrid" as provider
   - Enter API Key, From Email, and From Name
   - Test the connection

**Cost**: Free tier includes 100 emails/day. Paid plans available.

---

### 4. SMTP Email Setup

You can use any SMTP email service (Gmail, Outlook, etc.)

#### Gmail Example

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account → Security
   - Under "Signing in to Google", select "App passwords"
   - Generate a new app password for "Mail"

3. In Phindu Loans Admin Settings:
   - Navigate to **Settings** → **Integrations** → **Notification Providers** → **Email**
   - Enable Email Notifications
   - Select "SMTP" as provider
   - Configure:
     - **Host**: smtp.gmail.com
     - **Port**: 587
     - **Username**: your-email@gmail.com
     - **Password**: your-app-password (16 characters, no spaces)
     - **From Email**: your-email@gmail.com
     - **From Name**: Phindu Finance

#### Outlook/Office 365 Example

- **Host**: smtp.office365.com
- **Port**: 587
- **Username**: your-email@outlook.com
- **Password**: your password

**Cost**: Free for personal Gmail/Outlook accounts. Daily sending limits apply.

---

## Testing Your Configuration

After configuring each provider:

1. Click the "Test Connection" button for each channel
2. Check the test phone number/email for the test message
3. Review the notification logs in the admin panel
4. If test fails, verify:
   - Credentials are entered correctly
   - No extra spaces in API keys
   - Phone numbers are in correct format (+260...)
   - API keys have proper permissions

## Notification Preferences

Control which events trigger notifications:

1. Navigate to **Settings** → **Integrations** → **Notification Providers** → **Preferences**
2. Toggle each event type on/off:
   - Sign Up Welcome
   - Loan Approval
   - Loan Rejection
   - Disbursement Confirmation
   - Payment Received
   - Payment Reminders
   - Overdue Notices
   - Loan Completion

## Phone Number Format

The system automatically formats phone numbers for Zambia:
- Input: `0977123456` → Output: `+260977123456`
- Input: `+260977123456` → Output: `+260977123456`
- Input: `977123456` → Output: `+260977123456`

For international numbers, always include the country code with `+`.

## Multi-Channel Notifications

When both SMS, Email, and WhatsApp are enabled, notifications will be sent through all enabled channels simultaneously. This ensures maximum reach to borrowers.

Example: When a loan is approved, the borrower will receive:
- ✅ SMS to their phone
- ✅ WhatsApp message
- ✅ Email (if email address is provided)

## Notification Logs

All notification attempts are logged in the database with:
- Timestamp
- Type (SMS/Email/WhatsApp)
- Recipient
- Status (sent/failed/disabled)
- Provider response

Access logs via admin panel to monitor delivery rates and troubleshoot issues.

## Best Practices

1. **Start with Sandbox/Test Mode**: Use Africa's Talking sandbox or Twilio test credentials first
2. **Test Thoroughly**: Send test notifications before going live
3. **Monitor Delivery Rates**: Check notification logs regularly
4. **Set Appropriate Limits**: Be mindful of sending limits and costs
5. **Provide Opt-Out Options**: Allow borrowers to manage notification preferences
6. **Keep Credentials Secure**: Never commit API keys to version control
7. **Use Multi-Channel**: Enable multiple channels for important notifications
8. **Regular Backups**: Keep a backup of your notification settings

## Troubleshooting

### SMS Not Sending

- Verify phone number format
- Check API credentials
- Ensure sufficient balance in provider account
- Check provider service status
- Review notification logs for error details

### WhatsApp Not Sending

- Ensure WhatsApp Business API is approved
- Verify WhatsApp number format
- Check if recipient has WhatsApp
- Confirm message templates are approved (for Twilio)

### Email Not Sending

- Verify sender email is authenticated
- Check spam folder
- Ensure API key has mail send permissions
- For SMTP, verify port and authentication settings
- Check daily sending limits

### Test Connection Fails

- Double-check credentials (no extra spaces)
- Verify API key permissions
- Check network connectivity
- Try regenerating API keys
- Contact provider support

## Cost Estimation

### Africa's Talking (Zambia)
- SMS: ~K0.05 per message
- WhatsApp: Contact for pricing

### Twilio
- SMS: ~$0.0075 per message
- WhatsApp: ~$0.005 per message

### SendGrid
- Free: 100 emails/day
- Essentials: Starting at $19.95/month

*Prices are approximate. Check provider websites for current rates.*

## API Integration

Developers can use the notification service programmatically:

```typescript
import { notificationService } from "@/utils/notificationService";

// Send multi-channel notification
await notificationService.sendLoanApproval(
  userId,
  borrowerName,
  amount,
  phone,
  email // optional
);

// Send single channel
await notificationService.send({
  type: 'sms',
  to: '+260977123456',
  message: 'Your custom message',
  title: 'Custom Title',
  userId: 'user-id',
  eventType: 'notify_on_loan_approval'
});
```

## Support

For issues with:
- **Africa's Talking**: support@africastalking.com
- **Twilio**: https://support.twilio.com
- **SendGrid**: https://support.sendgrid.com
- **Phindu Loans**: support@phindu.co.zm

## Security Notes

- API keys are stored securely in the database
- Credentials are never exposed in client-side code
- All API calls go through secure edge functions
- Notification logs include minimal sensitive data
- Regular security audits recommended

## Migration from Old System

If you're upgrading from the old SMS-only system:

1. The old `smsService` still works (uses new system internally)
2. Update code to use `notificationService` for new features
3. Configure providers in admin settings
4. Test thoroughly before switching production
5. Old notification logs are preserved

## Version History

- **v2.0** (2026-01-08): Multi-provider support, WhatsApp, Email, preferences
- **v1.0** (2025-12-20): Initial Africa's Talking SMS only

---

**Last Updated**: January 8, 2026
