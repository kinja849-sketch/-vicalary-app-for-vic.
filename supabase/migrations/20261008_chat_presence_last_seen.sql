-- Chat presence: durable last_seen on user_profiles.
-- Writes happen through app/api/presence/last-seen (session-authenticated, server timestamp).

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE;

-- Fix: user_profiles is keyed by "id" (= auth.users.id); there is no "user_id" column.
-- The earlier version of this function (20260525_add_last_seen.sql) referenced user_id.
-- Non-fatal: this trigger runs inside Supabase Auth sign-in/refresh, so an error here
-- would surface as a 500 and sign the user out. Never let a presence write break auth.
CREATE OR REPLACE FUNCTION public.handle_last_seen()
RETURNS trigger AS $$
BEGIN
  UPDATE public.user_profiles
  SET last_seen = NEW.last_sign_in_at
  WHERE id = NEW.id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_last_seen failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
