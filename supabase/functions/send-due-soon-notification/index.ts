import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DueSoonNotificationRequest {
  loan_id: string;
  templateName?: string; // Optional: override default template name
  languageCode?: string; // Optional: override default language (default: 'en')
}

interface LoanData {
  id: string;
  borrower_name: string;
  borrower_phone: string;
  due_date: string;
  amount: number;
  status: string;
  // Additional fields that might exist
  full_name?: string;
  phone?: string;
  loan_amount?: number;
  monthly_payment?: number;
  user_id?: string;
}

/**
 * Format date to readable string for WhatsApp template
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-ZM', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format currency to readable string for WhatsApp template
 */
function formatCurrency(amount: number): string {
  return `K${amount.toLocaleString('en-ZM', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
}

/**
 * Fetch loan data from Supabase
 */
async function fetchLoanData(supabase: any, loanId: string): Promise<LoanData | null> {
  // Try to fetch from loan_applications table (main loans table)
  const { data: loan, error } = await supabase
    .from('loan_applications')
    .select(`
      id,
      full_name,
      phone,
      loan_amount,
      monthly_payment,
      status,
      user_id,
      loan_repayments!inner (
        due_date,
        amount,
        status
      )
    `)
    .eq('id', loanId)
    .eq('status', 'active')
    .order('loan_repayments.due_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Due Soon Notification] Error fetching loan:', error);
    return null;
  }

  if (!loan) {
    return null;
  }

  // Get the next due repayment
  const nextRepayment = loan.loan_repayments?.[0];
  if (!nextRepayment) {
    return null;
  }

  // Map to LoanData format
  return {
    id: loan.id,
    borrower_name: loan.full_name || 'Valued Customer',
    borrower_phone: loan.phone || '',
    due_date: nextRepayment.due_date,
    amount: nextRepayment.amount || loan.monthly_payment || loan.loan_amount || 0,
    status: loan.status,
    full_name: loan.full_name,
    phone: loan.phone,
    loan_amount: loan.loan_amount,
    monthly_payment: loan.monthly_payment,
    user_id: loan.user_id,
  };
}

/**
 * Send WhatsApp template message via Respond.io
 */
async function sendWhatsAppTemplate(
  supabase: any,
  loan: LoanData,
  templateName: string,
  languageCode: string
): Promise<any> {
  // Get Respond.io settings from system_settings
  const { data: settingsData, error: settingsError } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'notification_providers')
    .maybeSingle();

  if (settingsError || !settingsData) {
    throw new Error('Notification settings not found');
  }

  const settings = settingsData.value as any;

  // Check if Respond.io is configured
  if (!settings.respondio_api_key || !settings.respondio_whatsapp_channel_id) {
    throw new Error('Respond.io credentials not configured. Please configure in Admin Settings → Integrations → Notification Providers');
  }

  // Check if WhatsApp is enabled
  if (!settings.whatsapp_enabled) {
    throw new Error('WhatsApp notifications are disabled');
  }

  // Check if Respond.io is selected as WhatsApp provider
  if (settings.whatsapp_provider !== 'respondio') {
    throw new Error('Respond.io is not selected as WhatsApp provider. Please select Respond.io in notification settings.');
  }

  // Format phone number
  let phone = loan.borrower_phone || loan.phone || '';
  phone = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (phone.startsWith('0')) {
    phone = '+260' + phone.substring(1);
  } else if (!phone.startsWith('+')) {
    phone = '+260' + phone;
  }

  // Build template components
  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: loan.borrower_name },
        { type: 'text', text: formatCurrency(loan.amount) },
        { type: 'text', text: formatDate(loan.due_date) },
      ],
    },
  ];

  // Call the send-notification edge function with template parameters
  const { data, error } = await supabase.functions.invoke('send-notification', {
    body: {
      type: 'whatsapp',
      provider: 'respondio',
      to: phone,
      message: `Payment reminder: ${loan.borrower_name}, your payment of ${formatCurrency(loan.amount)} is due on ${formatDate(loan.due_date)}.`, // Fallback message
      templateName: templateName,
      templateLanguage: languageCode,
      templateComponents: components,
      userId: loan.user_id,
      title: 'Payment Due Soon',
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Auth check: require service role key
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (token !== supabaseKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: DueSoonNotificationRequest = await req.json();
    const { loan_id, templateName = 'loan_due_soon', languageCode = 'en' } = request;

    if (!loan_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: loan_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`[Due Soon Notification] Processing loan_id: ${loan_id}`);

    // Fetch loan data
    const loan = await fetchLoanData(supabase, loan_id);

    if (!loan) {
      return new Response(
        JSON.stringify({ error: 'Loan not found or not active' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (loan.status !== 'active') {
      return new Response(
        JSON.stringify({ error: `Loan status is '${loan.status}', expected 'active'` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!loan.borrower_phone && !loan.phone) {
      return new Response(
        JSON.stringify({ error: 'Borrower phone number not found' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Send WhatsApp template message
    const result = await sendWhatsAppTemplate(supabase, loan, templateName, languageCode);

    // Log to notification_logs
    try {
      await supabase.from('notification_logs').insert({
        user_id: loan.user_id || null,
        type: 'whatsapp',
        recipient: loan.borrower_phone || loan.phone || '',
        title: 'Payment Due Soon',
        message: `Payment reminder for ${formatCurrency(loan.amount)} due on ${formatDate(loan.due_date)}`,
        status: result?.success ? 'sent' : 'failed',
        sent_at: result?.success ? new Date().toISOString() : null,
        provider_response: { provider: 'respondio', template: templateName, ...result },
      });
    } catch (logError) {
      console.error('[Due Soon Notification] Failed to log:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'WhatsApp notification sent successfully',
        loan: {
          id: loan.id,
          borrower_name: loan.borrower_name,
          amount: loan.amount,
          due_date: loan.due_date,
        },
        result,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error: any) {
    console.error('[Due Soon Notification] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to send notification' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
