-- Migration: Phase 3 Stabilization Fixes
-- Date: 2024-05-17

-- 1. Recipes Table RLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can select recipes" ON recipes;
CREATE POLICY "Anyone can select recipes" 
ON recipes FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Authenticated users can upsert recipes" ON recipes;
CREATE POLICY "Authenticated users can upsert recipes" 
ON recipes FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 2. Chat Users RLS (Ensure profiles can see verification status)
ALTER TABLE chat_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can see chat user status" ON chat_users;
CREATE POLICY "Anyone can see chat user status" 
ON chat_users FOR SELECT 
USING (true);

-- 3. Robust User Resolution RPC
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
        COALESCE(cu.is_verified, false) as is_verified
    FROM user_profiles up
    LEFT JOIN chat_users cu ON up.id = cu.user_id
    WHERE 
        (up.username ILIKE p_identifier 
         OR cu.phone_number ILIKE p_identifier 
         OR up.id::TEXT = p_identifier)
    LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Robust Contact Addition RPC
DROP FUNCTION IF EXISTS add_contact_pure(UUID, UUID);
CREATE OR REPLACE FUNCTION add_contact_pure(p_user_id UUID, p_contact_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO contacts (user_id, contact_user_id, status)
    VALUES (p_user_id, p_contact_id, 'active')
    ON CONFLICT (user_id, contact_user_id) DO UPDATE 
    SET status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Mark Conversation as Read RPC
DROP FUNCTION IF EXISTS mark_conversation_as_read(UUID, UUID);
CREATE OR REPLACE FUNCTION mark_conversation_as_read(p_user_id UUID, p_conversation_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE conversation_participants
    SET last_read_at = now()
    WHERE user_id = p_user_id 
    AND conversation_id = p_conversation_id;
    
    -- Also update individual messages for this user
    UPDATE messages
    SET is_read = true, read_at = now()
    WHERE conversation_id = p_conversation_id
    AND sender_id != p_user_id
    AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
