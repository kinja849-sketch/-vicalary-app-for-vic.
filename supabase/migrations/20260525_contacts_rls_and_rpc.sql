-- 1. Enable RLS on contacts table
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- 2. Create select policy for authenticated users (to view their own contacts)
DROP POLICY IF EXISTS "Users can view own contacts" ON public.contacts;
CREATE POLICY "Users can view own contacts" ON public.contacts
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 3. Create delete policy for authenticated users (to delete their own contacts)
DROP POLICY IF EXISTS "Users can delete own contacts" ON public.contacts;
CREATE POLICY "Users can delete own contacts" ON public.contacts
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 4. Re-create find_user_by_identifier RPC to expand search scope to email and full name, and restrict to verified users
DROP FUNCTION IF EXISTS find_user_by_identifier(TEXT);
CREATE OR REPLACE FUNCTION find_user_by_identifier(p_identifier TEXT)
RETURNS TABLE (
    id UUID, 
    full_name TEXT, 
    avatar_url TEXT, 
    username TEXT, 
    phone_number TEXT,
    is_verified BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.id, 
        up.full_name, 
        up.avatar_url, 
        up.username, 
        cu.phone_number,
        true as is_verified
    FROM user_profiles up
    INNER JOIN chat_users cu ON up.id = cu.user_id
    WHERE 
        cu.is_verified = true
        AND (up.username ILIKE p_identifier 
             OR cu.phone_number ILIKE p_identifier 
             OR up.id::TEXT = p_identifier
             OR up.email ILIKE p_identifier
             OR up.full_name ILIKE p_identifier)
    LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
