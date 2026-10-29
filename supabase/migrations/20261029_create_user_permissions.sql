-- Idempotent Migration: Create public.user_permissions and reload PostgREST schema cache
CREATE TABLE IF NOT EXISTS public.user_permissions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    camera_permission_onboarded BOOLEAN DEFAULT FALSE,
    microphone_permission_onboarded BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS camera_permission_onboarded BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS microphone_permission_onboarded BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent duplication errors
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can insert/update their own permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can insert their own permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can update their own permissions" ON public.user_permissions;

-- RLS Policies
CREATE POLICY "Users can view their own permissions"
ON public.user_permissions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own permissions"
ON public.user_permissions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own permissions"
ON public.user_permissions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Grant permissions to Supabase roles so PostgREST exposes /rest/v1/user_permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO service_role;
GRANT SELECT ON public.user_permissions TO anon;

-- Force PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
