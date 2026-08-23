-- Migration: Unify System Chats and fix provisioning ambiguity
-- Date: 2024-05-22

-- 1. Fix provision_and_send_message to handle Health Coach (AI) identity
CREATE OR REPLACE FUNCTION provision_and_send_message(
    p_sender_id UUID,
    p_receiver_id UUID,
    p_content TEXT,
    p_message_type TEXT DEFAULT 'text',
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
    v_coach_id UUID := '00000000-0000-0000-0000-000000000001';
    v_conv_type TEXT := 'direct';
BEGIN
    -- Check if this involves the Health Coach
    IF p_sender_id = v_coach_id OR p_receiver_id = v_coach_id THEN
        v_conv_type := 'ai';
    END IF;

    -- 1. Try to find an existing conversation of the correct type
    SELECT c.id INTO v_conversation_id
    FROM conversations c
    JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
    JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
    WHERE c.conversation_type = v_conv_type
    AND cp1.user_id = p_sender_id
    AND cp2.user_id = p_receiver_id
    LIMIT 1;

    -- 2. If no conversation exists, create one
    IF v_conversation_id IS NULL THEN
        INSERT INTO conversations (conversation_type, name)
        VALUES (v_conv_type, CASE WHEN v_conv_type = 'ai' THEN 'Health Coach' ELSE NULL END)
        RETURNING id INTO v_conversation_id;

        -- Add participants
        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES (v_conversation_id, p_sender_id), (v_conversation_id, p_receiver_id);
    ELSE
        -- If it exists, ensure both participants have deleted_at = NULL
        UPDATE conversation_participants
        SET deleted_at = NULL, updated_at = now()
        WHERE conversation_id = v_conversation_id;
    END IF;

    -- 3. Insert the message
    INSERT INTO messages (conversation_id, sender_id, receiver_id, content, message_type, metadata)
    VALUES (v_conversation_id, p_sender_id, p_receiver_id, p_content, p_message_type, p_metadata);

    -- 4. Update conversation metadata
    UPDATE conversations
    SET 
        last_message_at = now(),
        last_message_content = p_content,
        last_message_type = p_message_type,
        last_message_sender_id = p_sender_id
    WHERE id = v_conversation_id;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Clean up duplicate "direct" conversations with the coach
-- If a user has both an 'ai' and a 'direct' conversation with the coach,
-- move messages from 'direct' to 'ai' and delete 'direct'.
DO $$
DECLARE
    v_coach_id UUID := '00000000-0000-0000-0000-000000000001';
    r RECORD;
BEGIN
    FOR r IN (
        -- Find users with both types of conversations with coach
        SELECT cp_ai.user_id, c_ai.id as ai_id, c_dir.id as dir_id
        FROM conversations c_ai
        JOIN conversation_participants cp_ai ON c_ai.id = cp_ai.conversation_id
        JOIN conversation_participants cp_ai_coach ON c_ai.id = cp_ai_coach.conversation_id
        
        JOIN conversations c_dir ON c_dir.conversation_type = 'direct'
        JOIN conversation_participants cp_dir ON c_dir.id = cp_dir.conversation_id
        JOIN conversation_participants cp_dir_coach ON c_dir.id = cp_dir_coach.conversation_id
        
        WHERE c_ai.conversation_type = 'ai'
        AND cp_ai_coach.user_id = v_coach_id
        AND cp_dir_coach.user_id = v_coach_id
        AND cp_ai.user_id = cp_dir.user_id
        AND cp_ai.user_id != v_coach_id
    ) LOOP
        -- Move messages
        UPDATE messages SET conversation_id = r.ai_id WHERE conversation_id = r.dir_id;
        -- Delete participants
        DELETE FROM conversation_participants WHERE conversation_id = r.dir_id;
        -- Delete conversation
        DELETE FROM conversations WHERE id = r.dir_id;
    END LOOP;
END;
$$;
