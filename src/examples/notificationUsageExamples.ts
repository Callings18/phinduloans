/**
 * Notification Service Usage Examples
 * 
 * This file demonstrates how to use the multi-provider notification service
 * for sending SMS, WhatsApp, and Email notifications in the Phindu Loans application.
 */

import { notificationService } from "@/utils/notificationService";

// ============================================================================
// Example 1: Send a single SMS
// ============================================================================
export async function example_sendSMS() {
  const result = await notificationService.send({
    type: 'sms',
    to: '+260977123456',
    message: 'Your loan application has been received and is under review.',
    title: 'Application Received',
    userId: 'user-uuid-here',
  });

  if (result.success) {
    console.log('SMS sent successfully');
  } else {
    console.error('Failed to send SMS:', result.error);
  }
}

// ============================================================================
// Example 2: Send a WhatsApp message
// ============================================================================
export async function example_sendWhatsApp() {
  const result = await notificationService.send({
    type: 'whatsapp',
    to: '+260977123456',
    message: 'Your payment of K5,000 has been received. Thank you!',
    title: 'Payment Confirmed',
    userId: 'user-uuid-here',
  });

  console.log('WhatsApp result:', result);
}

// ============================================================================
// Example 3: Send an Email
// ============================================================================
export async function example_sendEmail() {
  const result = await notificationService.send({
    type: 'email',
    to: 'borrower@example.com',
    subject: 'Loan Approval Notification',
    message: 'Congratulations! Your loan application has been approved. Please check your dashboard for details.',
    title: 'Loan Approved',
    userId: 'user-uuid-here',
  });

  console.log('Email result:', result);
}

// ============================================================================
// Example 4: Send Multi-Channel Notification (SMS + Email)
// ============================================================================
export async function example_sendMultiChannel() {
  const results = await notificationService.sendMultiChannel({
    userId: 'user-uuid-here',
    phone: '+260977123456',
    email: 'borrower@example.com',
    message: 'Your loan of K10,000 has been disbursed to your account.',
    subject: 'Loan Disbursed',
    title: 'Disbursement Confirmed',
  } as any);

  console.log('SMS result:', results.sms);
  console.log('Email result:', results.email);
}

// ============================================================================
// Example 5: Send Loan Approval Notification (Built-in Helper)
// ============================================================================
export async function example_loanApproval() {
  const results = await notificationService.sendLoanApproval(
    'user-uuid-here',      // userId
    'John Banda',          // borrowerName
    15000,                 // amount in ZMW
    '+260977123456',       // phone
    'john@example.com'     // email (optional)
  );

  // This automatically sends SMS, WhatsApp, and Email (if enabled)
  console.log('Loan approval notification sent:', results);
}

// ============================================================================
// Example 6: Send Payment Reminder
// ============================================================================
export async function example_paymentReminder() {
  const results = await notificationService.sendPaymentReminder(
    'user-uuid-here',
    'Jane Mwanza',
    5000,                  // amount due
    '2026-01-15',         // due date
    '+260966123456',
    'jane@example.com'
  );

  console.log('Reminder sent:', results);
}

// ============================================================================
// Example 7: Send Overdue Notice
// ============================================================================
export async function example_overdueNotice() {
  const results = await notificationService.sendOverdueNotice(
    'user-uuid-here',
    'Moses Phiri',
    8000,                  // overdue amount
    5,                     // days overdue
    '+260955123456',
    'moses@example.com'
  );

  console.log('Overdue notice sent:', results);
}

// ============================================================================
// Example 8: Send Disbursement Confirmation
// ============================================================================
export async function example_disbursementConfirmation() {
  const results = await notificationService.sendDisbursementConfirmation(
    'user-uuid-here',
    'Sarah Zulu',
    20000,
    'DISB-2026-001234',   // reference number
    '+260977987654',
    'sarah@example.com'
  );

  console.log('Disbursement confirmation sent:', results);
}

// ============================================================================
// Example 9: Send Payment Confirmation
// ============================================================================
export async function example_paymentConfirmation() {
  const results = await notificationService.sendPaymentConfirmation(
    'user-uuid-here',
    'David Mulenga',
    3000,                  // payment amount
    12000,                 // remaining balance
    '+260966789012',
    'david@example.com'
  );

  console.log('Payment confirmation sent:', results);
}

// ============================================================================
// Example 10: Send Loan Completion Message
// ============================================================================
export async function example_loanCompletion() {
  const results = await notificationService.sendLoanCompletion(
    'user-uuid-here',
    'Grace Tembo',
    '+260955456789',
    'grace@example.com'
  );

  console.log('Loan completion message sent:', results);
}

// ============================================================================
// Example 11: Send Collection Escalation Reminder
// ============================================================================
export async function example_collectionReminder() {
  const results = await notificationService.sendCollectionEscalation(
    'user-uuid-here',
    'Peter Sakala',
    15000,                 // outstanding amount
    2,                     // escalation level (1-5)
    '+260977234567',
    'peter@example.com'
  );

  console.log('Collection escalation sent:', results);
}

// ============================================================================
// Example 12: Send Welcome Message on Sign Up
// ============================================================================
export async function example_signupWelcome() {
  const results = await notificationService.sendSignupWelcome(
    'user-uuid-here',
    'Alice Banda',
    '+260966345678',
    'alice@example.com'
  );

  console.log('Welcome message sent:', results);
}

// ============================================================================
// Example 13: Send Loan Rejection Notice
// ============================================================================
export async function example_loanRejection() {
  const results = await notificationService.sendLoanRejection(
    'user-uuid-here',
    'Michael Chanda',
    '+260955567890',
    'michael@example.com',
    'Insufficient credit history'  // optional reason
  );

  console.log('Rejection notice sent:', results);
}

// ============================================================================
// Example 14: Integration with Loan Application Flow
// ============================================================================
export async function example_loanApplicationFlow(
  loanApplicationId: string,
  borrowerId: string,
  borrowerName: string,
  borrowerPhone: string,
  borrowerEmail: string,
  loanAmount: number,
  approved: boolean
) {
  // Step 1: Application Received (send confirmation)
  await notificationService.send({
    type: 'sms',
    to: borrowerPhone,
    message: `Dear ${borrowerName}, your loan application for K${loanAmount.toLocaleString()} has been received and is under review. Reference: ${loanApplicationId}`,
    title: 'Application Received',
    userId: borrowerId,
  });

  // Step 2: Wait for approval/rejection (this would be async in real flow)
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 3: Send approval or rejection
  if (approved) {
    await notificationService.sendLoanApproval(
      borrowerId,
      borrowerName,
      loanAmount,
      borrowerPhone,
      borrowerEmail
    );
  } else {
    await notificationService.sendLoanRejection(
      borrowerId,
      borrowerName,
      borrowerPhone,
      borrowerEmail,
      'Does not meet minimum credit requirements'
    );
  }
}

// ============================================================================
// Example 15: Batch Notifications (Send to Multiple Borrowers)
// ============================================================================
export async function example_batchReminders(borrowers: Array<{
  id: string;
  name: string;
  phone: string;
  email?: string;
  amountDue: number;
  dueDate: string;
}>) {
  const results = [];

  for (const borrower of borrowers) {
    const result = await notificationService.sendPaymentReminder(
      borrower.id,
      borrower.name,
      borrower.amountDue,
      borrower.dueDate,
      borrower.phone,
      borrower.email
    );
    results.push({ borrower: borrower.name, result });
  }

  console.log('Batch reminders sent:', results);
  return results;
}

// ============================================================================
// Example 16: Error Handling
// ============================================================================
export async function example_errorHandling() {
  try {
    const result = await notificationService.send({
      type: 'sms',
      to: '+260977123456',
      message: 'Test message',
      userId: 'user-uuid',
    });

    if (result.success) {
      console.log('✅ Notification sent successfully');
    } else {
      console.error('❌ Notification failed:', result.error);
      // Handle failure - maybe retry or log to monitoring system
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    // Handle unexpected errors
  }
}

// ============================================================================
// Example 17: Check Notification Settings Before Sending
// ============================================================================
export async function example_checkSettings() {
  // The notification service automatically checks settings
  // and only sends if the channel is enabled
  
  // If SMS is disabled in settings, this will log but not send
  const result = await notificationService.send({
    type: 'sms',
    to: '+260977123456',
    message: 'This message respects notification settings',
    userId: 'user-uuid',
  });

  console.log('Result:', result);
  // Will return { success: false, message: "Notifications not enabled" } if disabled
}

/**
 * NOTES:
 * 
 * 1. All phone numbers should be in international format (+260...)
 * 2. The service automatically formats Zambian numbers if they start with 0
 * 3. Multi-channel sends go through all enabled channels
 * 4. Notification preferences are checked automatically
 * 5. All notifications are logged to the database
 * 6. Provider credentials must be configured in admin settings
 * 7. Test your configuration before going live
 */
