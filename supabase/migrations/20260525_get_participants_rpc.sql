-- Create an RPC to fetch chat participants securely bypassing RLS
CREATE OR REPLACE FUNCTION get_chat_participants_rpc(p_conversation_id UUID)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    username TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE,
    last_seen TIMESTAMP WITH TIME ZONE,
    phone_number TEXT,
    is_verified BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cp.user_id,
        up.full_name,
        up.username,
        up.avatar_url,
        up.updated_at,
        up.last_seen,
        cu.phone_number,
        COALESCE(cu.is_verified, false)
    FROM conversation_participants cp
    JOIN user_profiles up ON cp.user_id = up.id
    LEFT JOIN chat_users cu ON up.id = cu.user_id
    WHERE cp.conversation_id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
