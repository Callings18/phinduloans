# Database Migration Required

## Migration File
**File:** `supabase/migrations/20260115_user_notification_preferences.sql`

## What This Migration Does
This migration adds user notification preference columns to the `profiles` table, allowing users to control how they receive notifications (email reminders, SMS reminders, payment alerts, and marketing communications).

## Migration Details

### Columns Added to `profiles` table:
1. `email_reminders` (boolean, default: true) - User preference for email payment reminders
2. `sms_reminders` (boolean, default: true) - User preference for SMS payment reminders  
3. `payment_alerts` (boolean, default: true) - User preference for payment confirmation alerts
4. `marketing` (boolean, default: false) - User preference for marketing and promotional notifications

### SQL Migration Content:
```sql
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
```

## How to Apply

### Option 1: Using Supabase CLI (Recommended)
```bash
# Navigate to your project directory
cd "path/to/phinduloans"

# Apply the migration
supabase db push
```

### Option 2: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/20260115_user_notification_preferences.sql`
4. Paste and execute the SQL

### Option 3: Direct SQL Execution
1. Connect to your Supabase database
2. Run the SQL commands from the migration file

## Verification

After applying the migration, verify it worked by running:

```sql
-- Check if columns exist
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('email_reminders', 'sms_reminders', 'payment_alerts', 'marketing');
```

You should see all 4 columns with their default values.

## Impact

- **No Breaking Changes**: All columns have default values, so existing users will have sensible defaults
- **Backward Compatible**: Existing code will continue to work
- **New Feature**: Users can now save their notification preferences in the Profile page

## Rollback (if needed)

If you need to rollback this migration:

```sql
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS email_reminders,
DROP COLUMN IF EXISTS sms_reminders,
DROP COLUMN IF EXISTS payment_alerts,
DROP COLUMN IF EXISTS marketing;
```

## Notes

- Default values ensure existing users have notifications enabled (except marketing)
- The migration uses `IF NOT EXISTS` to prevent errors if run multiple times
- All columns are nullable, but defaults are provided for better UX

---

**Migration Created:** 2026-01-15  
**Status:** Ready to apply  
**Priority:** Medium (required for notification preferences feature to work)
