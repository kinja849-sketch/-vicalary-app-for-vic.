-- Add Spiritual Scheduler settings to user_settings table

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS prayer_notifications_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pre_prayer_mins INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS post_prayer_mins INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS spiritual_intensity TEXT DEFAULT 'essential',
ADD COLUMN IF NOT EXISTS sleep_aware BOOLEAN DEFAULT true;

-- Ensure comment is added for context
COMMENT ON COLUMN user_settings.prayer_notifications_enabled IS 'Toggle for the daily spiritual scheduler notifications';
COMMENT ON COLUMN user_settings.pre_prayer_mins IS 'Minutes before prayer to show Hadith reminder';
COMMENT ON COLUMN user_settings.post_prayer_mins IS 'Minutes after prayer to show Quranic reminder';
COMMENT ON COLUMN user_settings.spiritual_intensity IS 'essential or comprehensive';
COMMENT ON COLUMN user_settings.sleep_aware IS 'Whether to silence notifications during normal sleeping hours';
