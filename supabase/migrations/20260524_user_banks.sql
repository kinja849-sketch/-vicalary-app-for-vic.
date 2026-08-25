CREATE TABLE IF NOT EXISTS public.user_banks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    account_id TEXT,
    account_name TEXT,
    balance NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.user_banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own connected banks"
    ON public.user_banks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connected banks"
    ON public.user_banks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connected banks"
    ON public.user_banks FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connected banks"
    ON public.user_banks FOR DELETE
    USING (auth.uid() = user_id);
