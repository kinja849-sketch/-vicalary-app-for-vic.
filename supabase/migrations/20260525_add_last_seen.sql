-- Add last_seen to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE;

-- Create a function to update last_seen on login
CREATE OR REPLACE FUNCTION public.handle_last_seen()
RETURNS trigger AS $$
BEGIN
  UPDATE public.user_profiles
  SET last_seen = NEW.last_sign_in_at
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_last_seen();
