-- Add brevo_whatsapp_templates table for managing WhatsApp template mappings
CREATE TABLE IF NOT EXISTS public.brevo_whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL UNIQUE,
  template_id TEXT NOT NULL,
  template_name TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brevo_whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can manage templates
CREATE POLICY "Admins can manage whatsapp templates"
  ON public.brevo_whatsapp_templates
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_brevo_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.brevo_whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default event types
INSERT INTO public.brevo_whatsapp_templates (event_type, template_id, template_name, description) VALUES
  ('otp', '', 'OTP Verification', 'Template for sending OTP codes'),
  ('loan_approval', '', 'Loan Approved', 'Template for loan approval notifications'),
  ('loan_rejection', '', 'Loan Rejected', 'Template for loan rejection notifications'),
  ('disbursement', '', 'Disbursement Confirmation', 'Template for disbursement confirmations'),
  ('payment_received', '', 'Payment Received', 'Template for payment confirmations'),
  ('payment_reminder', '', 'Payment Reminder', 'Template for payment due reminders'),
  ('overdue_notice', '', 'Overdue Notice', 'Template for overdue payment notices'),
  ('loan_completion', '', 'Loan Completion', 'Template for loan completion congratulations'),
  ('welcome', '', 'Welcome Message', 'Template for welcoming new users')
ON CONFLICT (event_type) DO NOTHING;