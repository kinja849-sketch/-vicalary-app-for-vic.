-- Migration: System Logs RLS Fix + Final Stabilization
-- Date: 2024-05-18

-- 1. Ensure system_logs has user_id and metadata columns
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. Enable RLS on system_logs
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can write own logs" ON system_logs;
DROP POLICY IF EXISTS "Users can read own logs" ON system_logs;
DROP POLICY IF EXISTS "Service role bypass" ON system_logs;

-- Users can insert their own logs
CREATE POLICY "Users can write own logs"
ON system_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can read their own logs
CREATE POLICY "Users can read own logs"
ON system_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. Fix messages table: ensure metadata column is JSONB
ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 4. Create GIN index on messages.metadata for faster JSONB queries
CREATE INDEX IF NOT EXISTS idx_messages_metadata ON messages USING GIN (metadata);

-- 5. Ensure messages has receiver_id for RLS
ALTER TABLE messages ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 6. Ensure messages RLS allows reading by conversation participants
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see their own messages" ON messages;
CREATE POLICY "Users can see their own messages"
ON messages FOR SELECT
TO authenticated
USING (
  sender_id = auth.uid() OR 
  receiver_id = auth.uid() OR
  conversation_id IN (
    SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages"
ON messages FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
CREATE POLICY "Users can update their own messages"
ON messages FOR UPDATE
TO authenticated
USING (
  sender_id = auth.uid() OR 
  receiver_id = auth.uid() OR
  conversation_id IN (
    SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
  )
);

-- 7. Create index on messages for daily summary lookups (metadata->type)
CREATE INDEX IF NOT EXISTS idx_messages_sender_metadata 
ON messages (sender_id, (metadata->>'type'), (metadata->>'date'));
