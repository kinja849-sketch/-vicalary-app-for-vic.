-- 1. Create user_financial_regions
CREATE TABLE IF NOT EXISTS public.user_financial_regions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL,
  country_name VARCHAR(100) NOT NULL,
  currency_code VARCHAR(3) NOT NULL,
  currency_symbol VARCHAR(10) NOT NULL,
  locale VARCHAR(20) NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  detection_method VARCHAR(50) NOT NULL
);

-- 2. Create bank_connections
CREATE TABLE IF NOT EXISTS public.bank_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  encrypted_access_token TEXT NOT NULL,
  provider_item_id TEXT NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL,
  last_successful_sync TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Create user_bank_accounts
CREATE TABLE IF NOT EXISTS public.user_bank_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_account_id TEXT NOT NULL UNIQUE,
  institution_id TEXT,
  institution_name TEXT,
  institution_logo TEXT,
  account_name TEXT NOT NULL,
  account_type VARCHAR(50) NOT NULL,
  account_subtype VARCHAR(50),
  currency_code VARCHAR(3) NOT NULL,
  current_balance DECIMAL NOT NULL,
  available_balance DECIMAL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Create financial_transactions
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES public.user_bank_accounts(id) ON DELETE CASCADE,
  provider_transaction_id TEXT UNIQUE,
  merchant_name TEXT,
  description TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  currency VARCHAR(3) NOT NULL,
  transaction_date TIMESTAMPTZ NOT NULL,
  category VARCHAR(100),
  subcategory VARCHAR(100),
  source VARCHAR(50) NOT NULL,
  is_pending BOOLEAN DEFAULT false NOT NULL,
  linked_transaction_id UUID,
  reconciliation_status VARCHAR(50) DEFAULT 'unmatched' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fin_tx_user_date ON public.financial_transactions(user_id, transaction_date DESC);

-- 5. Create product_price_cache
CREATE TABLE IF NOT EXISTS public.product_price_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT NOT NULL,
  retailer TEXT,
  country VARCHAR(2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  price DECIMAL NOT NULL,
  source VARCHAR(50) NOT NULL,
  confidence DECIMAL NOT NULL,
  retrieved_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prod_price_id_country ON public.product_price_cache(product_id, country);

-- Setup RLS (Row Level Security) for these tables
ALTER TABLE public.user_financial_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_price_cache ENABLE ROW LEVEL SECURITY;

-- Add basic policies (allowing the service_role full access which is standard)
-- Note: Further granular user policies can be applied later via Supabase dashboard
