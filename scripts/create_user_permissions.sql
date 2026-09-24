-- Create user_permissions table for durable application-level permission onboarding state
CREATE TABLE IF NOT EXISTS public.user_permissions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    camera_permission_onboarded BOOLEAN DEFAULT FALSE,
    microphone_permission_onboarded BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent duplication errors
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can insert/update their own permissions" ON public.user_permissions;

-- RLS Policies
CREATE POLICY "Users can view their own permissions" 
ON public.user_permissions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert/update their own permissions" 
ON public.user_permissions FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);
