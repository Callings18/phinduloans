-- Create settings table for storing payment gateway configuration
CREATE TABLE public.payment_gateway_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gateway_name TEXT NOT NULL UNIQUE,
  api_key TEXT,
  webhook_secret TEXT,
  is_active BOOLEAN DEFAULT false,
  environment TEXT DEFAULT 'sandbox',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_gateway_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can access payment settings
CREATE POLICY "Admins can view payment settings"
  ON public.payment_gateway_settings
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert payment settings"
  ON public.payment_gateway_settings
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update payment settings"
  ON public.payment_gateway_settings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete payment settings"
  ON public.payment_gateway_settings
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_payment_gateway_settings_updated_at
  BEFORE UPDATE ON public.payment_gateway_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default LENCO entry
INSERT INTO public.payment_gateway_settings (gateway_name, environment)
VALUES ('lenco', 'sandbox');