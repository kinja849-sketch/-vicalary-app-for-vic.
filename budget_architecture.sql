-- 1. Create user_budget_profiles table
CREATE TABLE IF NOT EXISTS public.user_budget_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    monthly_budget NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    budget_source VARCHAR(50) DEFAULT 'onboarding',
    financial_goal VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create daily_budget_status table
CREATE TABLE IF NOT EXISTS public.daily_budget_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    monthly_budget NUMERIC(12, 2) NOT NULL,
    daily_target NUMERIC(12, 2) NOT NULL,
    actual_spending NUMERIC(12, 2) NOT NULL,
    remaining NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'on_track',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- 3. Enable RLS
ALTER TABLE public.user_budget_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_budget_status ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for user_budget_profiles
CREATE POLICY "Users can view their own budget profiles" 
    ON public.user_budget_profiles FOR SELECT 
    TO authenticated 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budget profiles" 
    ON public.user_budget_profiles FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budget profiles" 
    ON public.user_budget_profiles FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- 5. Create RLS Policies for daily_budget_status
CREATE POLICY "Users can view their own daily budget status" 
    ON public.daily_budget_status FOR SELECT 
    TO authenticated 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily budget status" 
    ON public.daily_budget_status FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily budget status" 
    ON public.daily_budget_status FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);
