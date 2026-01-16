-- Migration: Add user notification preferences to profiles table
-- Date: 2026-01-15
-- Description: Adds notification preference columns to profiles table for user-specific notification settings

-- Add notification preference columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_reminders boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sms_reminders boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS payment_alerts boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS marketing boolean DEFAULT false;

-- Add comments
COMMENT ON COLUMN public.profiles.email_reminders IS 'User preference for receiving email payment reminders';
COMMENT ON COLUMN public.profiles.sms_reminders IS 'User preference for receiving SMS payment reminders';
COMMENT ON COLUMN public.profiles.payment_alerts IS 'User preference for receiving payment confirmation alerts';
COMMENT ON COLUMN public.profiles.marketing IS 'User preference for receiving marketing and promotional notifications';
