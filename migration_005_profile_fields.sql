-- Migration 005: Add additional profile fields to members table

-- Personal Information fields
ALTER TABLE members ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE members ADD COLUMN IF NOT EXISTS national_id VARCHAR(50);
ALTER TABLE members ADD COLUMN IF NOT EXISTS occupation VARCHAR(100);
ALTER TABLE members ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS county VARCHAR(100);
ALTER TABLE members ADD COLUMN IF NOT EXISTS sub_county VARCHAR(100);

-- Emergency Contact
ALTER TABLE members ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100);
ALTER TABLE members ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20);
ALTER TABLE members ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(50);

-- Privacy settings (stored as JSONB for flexibility)
ALTER TABLE members ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{
  "show_phone": true,
  "show_email": false,
  "show_contributions": true,
  "profile_visible": true
}'::jsonb;

-- Notification settings (stored as JSONB)
ALTER TABLE members ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
  "email_notifications": true,
  "sms_notifications": true,
  "contribution_reminders": true,
  "meeting_reminders": true,
  "payout_alerts": true,
  "news_updates": true
}'::jsonb;

-- Profile picture URL (for future use)
ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Last login timestamp
ALTER TABLE members ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Updated timestamp
ALTER TABLE members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_members_updated_at ON members;
CREATE TRIGGER update_members_updated_at
    BEFORE UPDATE ON members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
