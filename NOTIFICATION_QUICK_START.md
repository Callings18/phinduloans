# Notification System - Quick Start Guide

Get your notification system up and running in 15 minutes!

## Choose Your Provider

Pick ONE provider for each channel (or mix and match):

### For SMS:
- ✅ **Africa's Talking** (Recommended for Zambia) - Best local rates
- ✅ **Twilio** (Global) - More features, higher cost

### For WhatsApp:
- ✅ **Africa's Talking** (Recommended for Zambia)
- ✅ **Twilio** (Global) - Easier setup

### For Email:
- ✅ **SendGrid** (Recommended) - Free tier available
- ✅ **SMTP/Gmail** (Budget option) - Free but limited

---

## 🚀 Quick Setup: Africa's Talking (Recommended for Zambia)

### Step 1: Create Account (5 minutes)

1. Go to [africastalking.com](https://africastalking.com)
2. Click "Sign Up" → Complete registration
3. Verify your email and phone number
4. You'll start in SANDBOX mode (perfect for testing!)

### Step 2: Get Your Credentials (2 minutes)

1. Login to Africa's Talking dashboard
2. Username: Look at top right corner → Should say "sandbox" initially
3. API Key: Go to "Settings" → "API Key" → Click "Generate" or copy existing key

### Step 3: Configure in Phindu Loans (3 minutes)

1. Login to Phindu Loans as Admin
2. Go to: **Settings** → **Integrations** → **Notification Providers**
3. Click on **SMS** tab
4. Toggle "Enable SMS Notifications" to ON
5. Select "Africa's Talking" from dropdown
6. Enter:
   - **Username**: `sandbox` (for testing)
   - **API Key**: [paste your key]
   - **Sender ID**: `PHINDU` (or leave default)
7. Click "Test SMS Connection"
8. Check your phone for test message!

### Step 4: Enable Events (2 minutes)

1. Click on **Preferences** tab
2. Toggle ON the events you want:
   - ✅ Loan Approval (recommended)
   - ✅ Disbursement (recommended)
   - ✅ Payment Reminder (recommended)
   - ✅ Payment Received (recommended)
3. Click "Save Notification Settings"

### Step 5: Test It! (3 minutes)

1. Create a test loan application
2. Approve it
3. Check if borrower receives SMS
4. Check notification logs in admin panel

**Done! You're live with SMS notifications! 🎉**

---

## 🚀 Quick Setup: Twilio (Alternative)

### Step 1: Create Account (5 minutes)

1. Go to [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up → Get free trial credits ($15)
3. Verify your email and phone

### Step 2: Get Credentials (5 minutes)

1. From Twilio Console dashboard:
   - Copy **Account SID** (starts with "AC...")
   - Copy **Auth Token** (click eye icon to reveal)
2. Go to "Phone Numbers" → Buy a number (or use trial number)
   - Search for Zambian number if available
   - Or use any available number
3. Copy your **Phone Number** (format: +1234567890)

### Step 3: Configure in Phindu Loans (3 minutes)

1. Settings → Integrations → Notification Providers → SMS
2. Enable SMS, Select "Twilio"
3. Enter:
   - **Account SID**: [from step 2]
   - **Auth Token**: [from step 2]
   - **Phone Number**: [from step 2]
4. Test connection
5. Enable events in Preferences tab
6. Save settings

**Done! 🎉**

---

## 🚀 Quick Setup: SendGrid Email (Free)

### Step 1: Create Account (3 minutes)

1. Go to [sendgrid.com/free](https://sendgrid.com/free)
2. Sign up for free account (100 emails/day)
3. Verify your email

### Step 2: Create API Key (3 minutes)

1. SendGrid Dashboard → Settings → API Keys
2. Click "Create API Key"
3. Name it: "Phindu Loans"
4. Permissions: Select "Full Access" or "Mail Send"
5. Click "Create & View"
6. **COPY THE KEY NOW** (shown only once!)

### Step 3: Verify Sender Email (5 minutes)

1. Settings → Sender Authentication
2. Click "Verify a Single Sender"
3. Fill in your details:
   - From Name: Phindu Finance
   - From Email: noreply@phindu.co.zm (or your email)
   - Reply To: support@phindu.co.zm
4. Check your email → Click verification link

### Step 4: Configure in Phindu Loans (2 minutes)

1. Settings → Integrations → Notification Providers → Email
2. Enable Email, Select "SendGrid"
3. Enter:
   - **API Key**: [paste from step 2]
   - **From Email**: [same as verified in step 3]
   - **From Name**: Phindu Finance
4. Test connection
5. Enable events
6. Save

**Done! Email notifications active! 🎉**

---

## 🚀 Super Quick: Gmail SMTP (Free)

### Prerequisites
- Gmail account with 2FA enabled

### Setup (5 minutes total)

1. **Generate App Password**:
   - Google Account → Security → 2-Step Verification
   - Scroll to "App passwords"
   - Select "Mail" and "Other (Custom name)"
   - Name it "Phindu Loans"
   - Copy the 16-character password

2. **Configure in Phindu Loans**:
   - Settings → Integrations → Notification Providers → Email
   - Enable Email, Select "SMTP"
   - Enter:
     - Host: `smtp.gmail.com`
     - Port: `587`
     - Username: `your-email@gmail.com`
     - Password: [16-char app password]
     - From Email: `your-email@gmail.com`
     - From Name: `Phindu Finance`
   - Test connection
   - Enable events
   - Save

**Note**: Gmail has sending limits (500 emails/day). Good for testing!

---

## 💡 Pro Tips

### For Testing:
1. Start with **SANDBOX** mode (Africa's Talking)
2. Use **FREE TRIAL** credits (Twilio - $15 free)
3. Use **FREE TIER** (SendGrid - 100 emails/day)
4. Test with YOUR OWN phone/email first
5. Check notification logs regularly

### For Production:
1. Upgrade Africa's Talking from sandbox to live
2. Add credits to your account
3. Register a proper Sender ID (e.g., "PHINDU")
4. Verify domain for email (better deliverability)
5. Monitor costs and delivery rates

### Cost Saving:
1. Disable unnecessary events
2. Use SMS for critical notifications only
3. Use Email for detailed information
4. Batch reminders to send once daily
5. Monitor your provider balance

---

## 🎯 Recommended Setup for Microfinance

**Best Bang for Buck:**

| Channel | Provider | Cost/Month | Use For |
|---------|----------|------------|---------|
| SMS | Africa's Talking | K50-100 | Critical: Approvals, Disbursements, Overdue |
| Email | SendGrid Free | FREE | Details: Statements, Receipts, Newsletters |
| WhatsApp | Africa's Talking | K30-60 | Reminders, Confirmations |

**Total Cost**: ~K80-160/month (~$4-8/month) for 1000 borrowers

---

## 🐛 Troubleshooting

### SMS Not Working?
- ✅ Check API key is correct (no spaces)
- ✅ Verify username is "sandbox" or your actual username
- ✅ Ensure phone number format: +260977123456
- ✅ Check Africa's Talking dashboard for errors
- ✅ Verify you have credits (for live mode)

### Email Not Sending?
- ✅ Check sender email is verified
- ✅ Look in spam folder
- ✅ Verify API key has mail send permission
- ✅ For Gmail: Check app password is correct
- ✅ Check daily sending limits

### WhatsApp Not Working?
- ✅ Ensure you've applied for WhatsApp API access
- ✅ Number format must include "whatsapp:" prefix (Twilio)
- ✅ Recipient must have WhatsApp installed
- ✅ Check provider dashboard for approval status

### Still Stuck?
1. Check **Notification Logs** in admin panel
2. Look for error messages
3. Review `NOTIFICATION_PROVIDERS_SETUP.md` for detailed help
4. Contact provider support
5. Email: support@phindu.co.zm

---

## 📋 Checklist: Go Live

Before going live with notifications:

- [ ] Provider account created and verified
- [ ] API credentials configured in Phindu Loans
- [ ] Test connection successful for each channel
- [ ] Sent test notifications to your own phone/email
- [ ] Reviewed and enabled appropriate events
- [ ] Checked notification logs for errors
- [ ] Added credits to provider account (if needed)
- [ ] Informed borrowers they'll receive notifications
- [ ] Set up monitoring for delivery rates
- [ ] Documented credentials securely

---

## 🎓 Next Steps

Once basic setup is working:

1. **Review Analytics**: Check notification logs weekly
2. **Optimize Events**: Disable low-value notifications
3. **Add WhatsApp**: Better engagement than SMS
4. **Customize Messages**: Edit templates for your brand
5. **Monitor Costs**: Track spending vs budget
6. **Get Feedback**: Ask borrowers about notification preferences
7. **Scale Up**: Move from sandbox/trial to production

---

## 📞 Need Help?

- 📖 Full Guide: `NOTIFICATION_PROVIDERS_SETUP.md`
- 💻 Code Examples: `src/examples/notificationUsageExamples.ts`
- 📧 Email Support: support@phindu.co.zm
- 🌐 Africa's Talking: support@africastalking.com
- 🌐 Twilio: https://support.twilio.com
- 🌐 SendGrid: https://support.sendgrid.com

---

**Time to First Notification**: 15 minutes
**Difficulty**: Easy ⭐
**Cost**: Free to start, ~K80-160/month for production

Happy Notifying! 🎉📱📧
