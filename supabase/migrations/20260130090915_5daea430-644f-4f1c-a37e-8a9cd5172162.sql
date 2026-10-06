-- Create table to store OTP codes
CREATE TABLE public.otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  purpose TEXT NOT NULL DEFAULT 'signup' -- signup, login, verify
);

-- Create index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON public.otp_codes (phone);

-- Create index for cleanup of expired codes
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON public.otp_codes (expires_at);

-- Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Allow insert from service role and anonymous (for signup flow)
DROP POLICY IF EXISTS "Allow OTP creation" ON public.otp_codes;
CREATE POLICY "Allow OTP creation" 
ON public.otp_codes 
FOR INSERT 
WITH CHECK (true);

-- Allow select for verification (service role will handle this)
DROP POLICY IF EXISTS "Allow OTP verification" ON public.otp_codes;
CREATE POLICY "Allow OTP verification" 
ON public.otp_codes 
FOR SELECT 
USING (true);

-- Allow update for marking as verified
DROP POLICY IF EXISTS "Allow OTP update" ON public.otp_codes;
CREATE POLICY "Allow OTP update" 
ON public.otp_codes 
FOR UPDATE 
USING (true);

-- Allow delete for cleanup
DROP POLICY IF EXISTS "Allow OTP deletion" ON public.otp_codes;
CREATE POLICY "Allow OTP deletion" 
ON public.otp_codes 
FOR DELETE 
USING (true);

-- Create function to clean up expired OTPs (can be called by cron or manually)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.otp_codes WHERE expires_at < now();
END;
$$;