-- Migration: Fix Coach Handoff RPC Return Type
-- Date: 2026-05-25

DROP FUNCTION IF EXISTS provision_user_system_chats(UUID);

CREATE OR REPLACE FUNCTION provision_user_system_chats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_coach_id UUID := '00000000-0000-0000-0000-000000000001';
    v_self_conv_id UUID;
    v_coach_conv_id UUID;
BEGIN
    -- Scoped search for Self Chat
    SELECT c.id INTO v_self_conv_id
    FROM conversations AS c
    JOIN conversation_participants AS cp1 ON c.id = cp1.conversation_id
    WHERE c.conversation_type = 'self'
    AND cp1.user_id = p_user_id;

    IF v_self_conv_id IS NULL THEN
        INSERT INTO conversations (conversation_type, name)
        VALUES ('self', 'Notes to Self')
        RETURNING id INTO v_self_conv_id;

        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES (v_self_conv_id, p_user_id);
    END IF;

    -- Scoped search for Health Coach Chat
    SELECT c.id INTO v_coach_conv_id
    FROM conversations AS c
    JOIN conversation_participants AS cp1 ON c.id = cp1.conversation_id
    JOIN conversation_participants AS cp2 ON c.id = cp2.conversation_id
    WHERE c.conversation_type = 'ai'
    AND cp1.user_id = p_user_id
    AND cp2.user_id = v_coach_id;

    IF v_coach_conv_id IS NULL THEN
        INSERT INTO conversations (conversation_type, name)
        VALUES ('ai', 'Health Coach')
        RETURNING id INTO v_coach_conv_id;

        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES (v_coach_conv_id, p_user_id), (v_coach_conv_id, v_coach_id);
        
        -- Initial welcome message
        INSERT INTO messages (conversation_id, sender_id, content, message_type)
        VALUES (v_coach_conv_id, v_coach_id, 'Hello! I am your VicAlary Health Coach. I will provide you with daily summaries and insights about your health journey.', 'text');
    END IF;

    RETURN jsonb_build_object(
        'self_conversation_id', v_self_conv_id,
        'coach_conversation_id', v_coach_conv_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
