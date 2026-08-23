-- Migration: Fix Management Columns & Add updated_at
-- Date: 2024-05-20

-- 1. Add updated_at to conversation_participants if missing
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Ensure all management functions are robust
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

CREATE OR REPLACE FUNCTION archive_conversation(p_user_id UUID, p_conversation_id UUID, p_is_archived BOOLEAN)
RETURNS VOID AS $$
BEGIN
    UPDATE conversation_participants
    SET is_archived = p_is_archived, updated_at = now()
    WHERE user_id = p_user_id AND conversation_id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mute_conversation(p_user_id UUID, p_conversation_id UUID, p_is_muted BOOLEAN)
RETURNS VOID AS $$
BEGIN
    UPDATE conversation_participants
    SET is_muted = p_is_muted, updated_at = now()
    WHERE user_id = p_user_id AND conversation_id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION clear_chat_history(p_user_id UUID, p_conversation_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE conversation_participants
    SET cleared_at = now(), updated_at = now()
    WHERE user_id = p_user_id AND conversation_id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION delete_conversation(p_user_id UUID, p_conversation_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE conversation_participants
    SET deleted_at = now(), updated_at = now()
    WHERE user_id = p_user_id AND conversation_id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
