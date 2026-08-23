-- 1. Create a function that deletes a user's storage files when they are deleted
CREATE OR REPLACE FUNCTION public.handle_deleted_user_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete all files uploaded by this user in the storage buckets
  DELETE FROM storage.objects WHERE owner = OLD.id;
  
  -- Delete the user's chat_users record (freeing their phone number)
  DELETE FROM public.chat_users WHERE user_id = OLD.id;
  
  -- Delete the user's profile (if it doesn't already Cascade automatically)
  DELETE FROM public.user_profiles WHERE id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- 2. Attach the trigger to the auth.users table
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_deleted_user_cleanup();
