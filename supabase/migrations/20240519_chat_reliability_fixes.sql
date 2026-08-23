-- Migration: Chat Reliability & Robust Provisioning
-- Date: 2024-05-19

-- 1. Add helper for finding conversation by participants (used by UI for virtual chats)
DROP FUNCTION IF EXISTS find_conversation_by_participants(UUID, UUID);
CREATE OR REPLACE FUNCTION find_conversation_by_participants(p_user1 UUID, p_user2 UUID)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    SELECT c.id INTO v_id
    FROM conversations c
    JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
    JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
    WHERE c.conversation_type = 'direct'
    AND cp1.user_id = p_user1
    AND cp2.user_id = p_user2
    LIMIT 1;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Robust Provisioning and Messaging RPC
DROP FUNCTION IF EXISTS provision_and_send_message(UUID, UUID, TEXT, TEXT, JSONB);
CREATE OR REPLACE FUNCTION provision_and_send_message(
    p_sender_id UUID,
    p_receiver_id UUID,
    p_content TEXT,
    p_message_type TEXT DEFAULT 'text',
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
BEGIN
    -- 1. Try to find an existing direct conversation between these two users
    SELECT c.id INTO v_conversation_id
    FROM conversations c
    JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
    JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
    WHERE c.conversation_type = 'direct'
    AND cp1.user_id = p_sender_id
    AND cp2.user_id = p_receiver_id
    LIMIT 1;

    -- 2. If no conversation exists, create one
    IF v_conversation_id IS NULL THEN
        INSERT INTO conversations (conversation_type, name)
        VALUES ('direct', NULL)
        RETURNING id INTO v_conversation_id;

        -- Add participants
        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES (v_conversation_id, p_sender_id), (v_conversation_id, p_receiver_id);
    ELSE
        -- If it exists, ensure both participants have deleted_at = NULL so it reappears
        UPDATE conversation_participants
        SET deleted_at = NULL, updated_at = now()
        WHERE conversation_id = v_conversation_id;
    END IF;

    -- 3. Insert the message
    INSERT INTO messages (conversation_id, sender_id, receiver_id, content, message_type, metadata)
    VALUES (v_conversation_id, p_sender_id, p_receiver_id, p_content, p_message_type, p_metadata);

    -- 4. Update conversation's last message metadata for fast previews
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
