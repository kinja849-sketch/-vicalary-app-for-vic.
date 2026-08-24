-- 1. Enable RLS on calls table
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own calls" ON public.calls;
DROP POLICY IF EXISTS "Users can insert their own calls" ON public.calls;
DROP POLICY IF EXISTS "Users can update their own calls" ON public.calls;

-- 3. Create SELECT policy for authenticated users (to view their own calls)
CREATE POLICY "Users can view their own calls" ON public.calls
    FOR SELECT
    TO authenticated
    USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- 4. Create INSERT policy for authenticated users (to start calls)
CREATE POLICY "Users can insert their own calls" ON public.calls
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = caller_id);

-- 5. Create UPDATE policy for authenticated users (to accept/decline/end calls)
CREATE POLICY "Users can update their own calls" ON public.calls
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = caller_id OR auth.uid() = receiver_id)
    WITH CHECK (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- 6. Fix check constraint to allow 'cancelled' status
ALTER TABLE public.calls DROP CONSTRAINT IF EXISTS calls_status_check;
ALTER TABLE public.calls ADD CONSTRAINT calls_status_check CHECK (status IN ('ringing', 'connected', 'ended', 'declined', 'missed', 'cancelled'));

-- 7. CRITICAL: Enable REPLICA IDENTITY FULL so filtered realtime subscriptions work
-- Without this, receiver_id filter silently fails and the receiver never sees incoming calls
ALTER TABLE public.calls REPLICA IDENTITY FULL;

-- 8. Add calls table to Supabase realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;

-- 9. Clean up all old mock/stale calls for testing
TRUNCATE TABLE public.calls CASCADE;
