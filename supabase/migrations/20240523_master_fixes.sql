-- Migration: Master Fixes for VicAlary
-- Date: 2024-05-23

-- 1. Fix user_recipe_interactions constraints to prevent 500 errors on upsert
-- First, clean up any duplicates that would prevent constraint creation
DELETE FROM user_recipe_interactions a
USING user_recipe_interactions b
WHERE a.id < b.id 
  AND a.user_id = b.user_id 
  AND a.recipe_id = b.recipe_id 
  AND a.interaction_type = b.interaction_type;

-- Add the composite unique constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_recipe_interactions_upsert_idx'
    ) THEN
        -- Fix RLS for recipes to allow caching
        ALTER TABLE recipes DISABLE ROW LEVEL SECURITY;
        ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Authenticated users can upsert recipes" ON recipes;
        CREATE POLICY "Anyone can upsert recipes" ON recipes
            FOR ALL USING (true) WITH CHECK (true);
        ALTER TABLE user_recipe_interactions 
        ADD CONSTRAINT user_recipe_interactions_upsert_idx 
        UNIQUE (user_id, recipe_id, interaction_type);
    END IF;
END $$;

-- 2. Scoped Scoping for provision_user_system_chats to avoid ambiguity
CREATE OR REPLACE FUNCTION provision_user_system_chats(p_user_id UUID)
RETURNS VOID AS $$
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Optimized get_user_conversations to handle all types correctly
DROP FUNCTION IF EXISTS get_user_conversations(UUID);
DROP FUNCTION IF EXISTS get_user_conversations();
CREATE OR REPLACE FUNCTION get_user_conversations(p_user_id UUID)
RETURNS TABLE(
    id UUID,
    conversation_type TEXT,
    name TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    last_message_content TEXT,
    last_message_type TEXT,
    last_message_sender_id UUID,
    unread_count BIGINT,
    other_participant_info JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.conversation_type,
        c.name,
        c.last_message_at,
        c.last_message_content,
        c.last_message_type,
        c.last_message_sender_id::UUID,
        (
            SELECT COUNT(*) 
            FROM messages m 
            WHERE m.conversation_id = c.id 
            AND m.sender_id != p_user_id
            AND m.read_at IS NULL
        ) AS unread_count,
        (
            SELECT jsonb_build_object(
                'id', up.id,
                'username', up.username,
                'full_name', up.full_name,
                'avatar_url', up.avatar_url
            )
            FROM conversation_participants cp
            JOIN user_profiles up ON cp.user_id = up.id
            WHERE cp.conversation_id = c.id
            AND cp.user_id != p_user_id
            LIMIT 1
        ) AS other_participant_info
    FROM conversations c
    JOIN conversation_participants me ON c.id = me.conversation_id
    WHERE me.user_id = p_user_id
    ORDER BY c.last_message_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
