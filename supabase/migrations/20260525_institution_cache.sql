CREATE TABLE IF NOT EXISTS public.institution_cache (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    institution_id TEXT NOT NULL,
    name TEXT NOT NULL,
    logo_url TEXT,
    country_code TEXT NOT NULL,
    provider TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(institution_id, country_code)
);

-- Enable RLS
ALTER TABLE public.institution_cache ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated and anonymous users
CREATE POLICY "Allow public read access to institution_cache" 
    ON public.institution_cache 
    FOR SELECT 
    USING (true);

-- Restrict insert/update/delete to service role only
CREATE POLICY "Allow service role full access to institution_cache" 
    ON public.institution_cache 
    FOR ALL 
    USING (auth.jwt() ->> 'role' = 'service_role');
