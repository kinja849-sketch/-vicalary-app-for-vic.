-- Migration: Chat Management Features
-- Date: 2024-05-19

-- 1. Add management columns to conversation_participants
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT false;
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ;

-- 2. Optimized RPC to fetch conversations for a user
DROP FUNCTION IF EXISTS get_user_conversations(UUID);
CREATE OR REPLACE FUNCTION get_user_conversations(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    conversation_type TEXT,
    created_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    last_message_content TEXT,
    last_message_type TEXT,
    last_message_sender_id UUID,
    is_archived BOOLEAN,
    is_muted BOOLEAN,
    unread_count BIGINT,
    other_participant_info JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH participant_info AS (
        SELECT 
            cp.conversation_id,
            cp.is_archived,
            cp.is_muted,
            cp.last_read_at,
            cp.cleared_at
        FROM conversation_participants cp
        WHERE cp.user_id = p_user_id AND cp.deleted_at IS NULL
    ),
    unread_counts AS (
        SELECT 
            m.conversation_id,
            COUNT(*) as count
        FROM messages m
        JOIN participant_info pi ON m.conversation_id = pi.conversation_id
        WHERE m.sender_id != p_user_id 
          AND (pi.last_read_at IS NULL OR m.created_at > pi.last_read_at)
          AND (pi.cleared_at IS NULL OR m.created_at > pi.cleared_at)
        GROUP BY m.conversation_id
    ),
    other_participants AS (
        -- For 1:1 chats, get the other person's profile
        -- For self chats, it will be empty
        SELECT 
            cp.conversation_id,
            jsonb_build_object(
                'id', up.id,
                'full_name', up.full_name,
                'avatar_url', up.avatar_url,
                'phone_number', cu.phone_number
            ) as profile
        FROM conversation_participants cp
        JOIN user_profiles up ON cp.user_id = up.id
        LEFT JOIN chat_users cu ON up.id = cu.user_id
        WHERE cp.user_id != p_user_id
    )
    SELECT 
        c.id,
        c.conversation_type,
        c.created_at,
        c.last_message_at,
        c.last_message_content,
        c.last_message_type,
        c.last_message_sender_id,
        COALESCE(pi.is_archived, false),
        COALESCE(pi.is_muted, false),
        COALESCE(uc.count, 0),
        COALESCE(op.profile, '{}'::jsonb)
    FROM conversations c
    JOIN participant_info pi ON c.id = pi.conversation_id
    LEFT JOIN unread_counts uc ON c.id = uc.conversation_id
    LEFT JOIN other_participants op ON c.id = op.conversation_id
    ORDER BY c.last_message_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Archive Conversation RPC
CREATE OR REPLACE FUNCTION archive_conversation(p_user_id UUID, p_conversation_id UUID, p_is_archived BOOLEAN)
RETURNS VOID AS $$
BEGIN
    UPDATE conversation_participants
    SET is_archived = p_is_archived, updated_at = now()
    WHERE user_id = p_user_id AND conversation_id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Mute Conversation RPC
CREATE OR REPLACE FUNCTION mute_conversation(p_user_id UUID, p_conversation_id UUID, p_is_muted BOOLEAN)
RETURNS VOID AS $$
BEGIN
    UPDATE conversation_participants
    SET is_muted = p_is_muted, updated_at = now()
    WHERE user_id = p_user_id AND conversation_id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Clear Chat History RPC (Soft delete)
CREATE OR REPLACE FUNCTION clear_chat_history(p_user_id UUID, p_conversation_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE conversation_participants
    SET cleared_at = now(), updated_at = now()
    WHERE user_id = p_user_id AND conversation_id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Delete Conversation RPC (Soft delete)
CREATE OR REPLACE FUNCTION delete_conversation(p_user_id UUID, p_conversation_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE conversation_participants
    SET deleted_at = now(), updated_at = now()
    WHERE user_id = p_user_id AND conversation_id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Fix mark_conversation_as_read to be more robust
CREATE OR REPLACE FUNCTION mark_conversation_as_read(p_user_id UUID, p_conversation_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE conversation_participants
    SET last_read_at = now(), updated_at = now()
    WHERE user_id = p_user_id AND conversation_id = p_conversation_id;
    
    -- Mark individual messages as read for this receiver
    UPDATE messages
    SET is_read = true, read_at = now()
    WHERE conversation_id = p_conversation_id
    AND sender_id != p_user_id
    AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
