-- Migration: VICALARY Stabilization Fixes
-- Date: 2024-05-16

-- 1. Table Schema Updates
-- Ensure metadata exists for interactions
ALTER TABLE user_recipe_interactions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add unique constraint to recipes.spoonacular_id to allow clean upserts from external API
-- This is critical for mapping external IDs to internal UUIDs
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recipes_spoonacular_id_key') THEN
        ALTER TABLE recipes ADD CONSTRAINT recipes_spoonacular_id_key UNIQUE (spoonacular_id);
    END IF;
END $$;

-- 2. Cookbook Expiration Logic
CREATE OR REPLACE FUNCTION expire_old_suggestions(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Move 'suggested' interactions that are NOT from today to 'expired' state
    UPDATE user_recipe_interactions
    SET interaction_type = 'expired'
    WHERE user_id = p_user_id
    AND interaction_type = 'suggested'
    AND interacted_at < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Chat: Mark All as Read Logic
CREATE OR REPLACE FUNCTION mark_all_messages_read(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE messages
    SET is_read = true, read_at = now()
    WHERE receiver_id = p_user_id
    AND is_read = false
    AND sender_id != p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS Policy Enforcement
ALTER TABLE user_recipe_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own interactions" ON user_recipe_interactions;
CREATE POLICY "Users can manage their own interactions" 
ON user_recipe_interactions 
FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 5. Timezone Support
ALTER TABLE user_settings ALTER COLUMN timezone SET DEFAULT 'UTC';
