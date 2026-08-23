CREATE TABLE IF NOT EXISTS public.banking_tokens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    provider TEXT NOT NULL, -- 'plaid' or 'gocardless'
    access_token TEXT NOT NULL,
    item_id TEXT, -- For Plaid
    requisition_id TEXT, -- For GoCardless
    institution_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, institution_id)
);

-- Enable RLS
ALTER TABLE public.banking_tokens ENABLE ROW LEVEL SECURITY;

-- The frontend should NEVER be able to read or write tokens directly.
-- All interactions with this table must happen via the backend using the service_role key.
CREATE POLICY "Strictly deny all frontend access to banking_tokens" 
    ON public.banking_tokens 
    FOR ALL 
    USING (false);

-- (Optional) If you want users to be able to see WHICH banks they have linked, 
-- but NOT see the tokens, you would create a view or just rely on the backend.
