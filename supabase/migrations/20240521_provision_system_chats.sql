-- Migration: Provision System Chats & Fix RPC Return Types
-- Date: 2024-05-21

-- 1. Fix get_user_conversations RPC to cast last_message_sender_id to UUID
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
        c.last_message_sender_id::UUID, -- Cast to UUID to match return type
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

-- 2. Ensure Health Coach profile exists
INSERT INTO user_profiles (id, full_name, avatar_url, username)
VALUES ('00000000-0000-0000-0000-000000000001', 'VicAlary Health Coach', 'https://vicalary.app/coach-avatar.png', 'coach')
ON CONFLICT (id) DO NOTHING;

-- 3. Provision User System Chats RPC
DROP FUNCTION IF EXISTS provision_user_system_chats(UUID);
CREATE OR REPLACE FUNCTION provision_user_system_chats(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_coach_id UUID := '00000000-0000-0000-0000-000000000001';
    v_self_conv_id UUID;
    v_coach_conv_id UUID;
BEGIN
    -- 1. Provision Self Chat (Notes to Self)
    SELECT c.id INTO v_self_conv_id
    FROM conversations c
    JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
    JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
    WHERE c.conversation_type = 'self'
    AND cp1.user_id = p_user_id
    AND cp2.user_id = p_user_id
    LIMIT 1;

    IF v_self_conv_id IS NULL THEN
        INSERT INTO conversations (conversation_type, name)
        VALUES ('self', 'Notes to Self')
        RETURNING id INTO v_self_conv_id;

        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES (v_self_conv_id, p_user_id);
    END IF;

    -- 2. Provision Health Coach Chat
    SELECT c.id INTO v_coach_conv_id
    FROM conversations c
    JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
    JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
    WHERE c.conversation_type = 'ai'
    AND cp1.user_id = p_user_id
    AND cp2.user_id = v_coach_id
    LIMIT 1;

    IF v_coach_conv_id IS NULL THEN
        INSERT INTO conversations (conversation_type, name)
        VALUES ('ai', 'Health Coach')
        RETURNING id INTO v_coach_conv_id;

        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES (v_coach_conv_id, p_user_id), (v_coach_conv_id, v_coach_id);
        
        -- Initial welcome message from Coach
        INSERT INTO messages (conversation_id, sender_id, receiver_id, content, message_type)
        VALUES (v_coach_conv_id, v_coach_id, p_user_id, 'Hello! I am your VicAlary Health Coach. I will provide you with daily summaries and insights about your health journey.', 'text');
        
        UPDATE conversations 
        SET last_message_at = now(), 
            last_message_content = 'Hello! I am your VicAlary Health Coach...', 
            last_message_sender_id = v_coach_id::TEXT 
        WHERE id = v_coach_conv_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
