CREATE TABLE IF NOT EXISTS public.connected_banks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    institution_id TEXT NOT NULL,
    institution_name TEXT NOT NULL,
    institution_logo TEXT,
    account_mask TEXT,
    account_type TEXT,
    sync_status TEXT DEFAULT 'success',
    last_sync TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_institution UNIQUE (user_id, institution_id)
);

-- Enable RLS
ALTER TABLE public.connected_banks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own connected banks" ON public.connected_banks;
CREATE POLICY "Users can view their own connected banks"
    ON public.connected_banks FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own connected banks" ON public.connected_banks;
CREATE POLICY "Users can insert their own connected banks"
    ON public.connected_banks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own connected banks" ON public.connected_banks;
CREATE POLICY "Users can update their own connected banks"
    ON public.connected_banks FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own connected banks" ON public.connected_banks;
CREATE POLICY "Users can delete their own connected banks"
    ON public.connected_banks FOR DELETE
    USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS public.account_balances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    available_balance NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own account balances" ON public.account_balances;
CREATE POLICY "Users can view their own account balances"
    ON public.account_balances FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert/update their own account balances" ON public.account_balances;
CREATE POLICY "Users can insert/update their own account balances"
    ON public.account_balances FOR ALL
    USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS public.budget_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    objective TEXT NOT NULL,
    target_spending NUMERIC NOT NULL,
    timeframe TEXT NOT NULL,
    recommendations TEXT,
    pacing TEXT,
    risk_analysis TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.budget_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own budget goals" ON public.budget_goals;
CREATE POLICY "Users can view their own budget goals"
    ON public.budget_goals FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own budget goals" ON public.budget_goals;
CREATE POLICY "Users can insert their own budget goals"
    ON public.budget_goals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own budget goals" ON public.budget_goals;
CREATE POLICY "Users can update their own budget goals"
    ON public.budget_goals FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own budget goals" ON public.budget_goals;
CREATE POLICY "Users can delete their own budget goals"
    ON public.budget_goals FOR DELETE
    USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    plaid_transaction_id TEXT UNIQUE NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    pending BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own cached transactions" ON public.transactions;
CREATE POLICY "Users can view their own cached transactions"
    ON public.transactions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert/update their own cached transactions" ON public.transactions;
CREATE POLICY "Users can insert/update their own cached transactions"
    ON public.transactions FOR ALL
    USING (auth.uid() = user_id);
