-- Idempotent Migration: Parent-First Boycott Resolution & Brand-to-Parent Registry
-- Creates boycott_campaigns, campaign_targets, company_relationships, user_campaign_preferences, and product_boycott_matches

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. boycott_campaigns
CREATE TABLE IF NOT EXISTS public.boycott_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  organization TEXT,
  description TEXT,
  source_url TEXT,
  status TEXT DEFAULT 'active',
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. campaign_targets
CREATE TABLE IF NOT EXISTS public.campaign_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.boycott_campaigns(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  normalized_name TEXT,
  aliases TEXT[] DEFAULT '{}',
  target_type TEXT NOT NULL DEFAULT 'parent',
  reason TEXT,
  source_url TEXT,
  verified_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (campaign_id, company_name)
);

ALTER TABLE public.campaign_targets ADD COLUMN IF NOT EXISTS normalized_name TEXT;
ALTER TABLE public.campaign_targets ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_campaign_targets_company_name ON public.campaign_targets (LOWER(company_name));
CREATE INDEX IF NOT EXISTS idx_campaign_targets_normalized_name ON public.campaign_targets (normalized_name);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_campaign_id ON public.campaign_targets (campaign_id);

-- 3. company_relationships
CREATE TABLE IF NOT EXISTS public.company_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name TEXT NOT NULL,
  normalized_brand TEXT,
  parent_company TEXT NOT NULL,
  normalized_parent TEXT,
  raw_parent_text TEXT,
  relationship_type TEXT NOT NULL DEFAULT 'subsidiary',
  notes TEXT,
  source_url TEXT,
  verified_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (brand_name, parent_company)
);

ALTER TABLE public.company_relationships ADD COLUMN IF NOT EXISTS normalized_brand TEXT;
ALTER TABLE public.company_relationships ADD COLUMN IF NOT EXISTS normalized_parent TEXT;
ALTER TABLE public.company_relationships ADD COLUMN IF NOT EXISTS raw_parent_text TEXT;
ALTER TABLE public.company_relationships ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_company_relationships_brand_lower ON public.company_relationships (LOWER(brand_name));
CREATE INDEX IF NOT EXISTS idx_company_relationships_normalized_brand ON public.company_relationships (normalized_brand);
CREATE INDEX IF NOT EXISTS idx_company_relationships_normalized_parent ON public.company_relationships (normalized_parent);

-- 4. user_campaign_preferences
CREATE TABLE IF NOT EXISTS public.user_campaign_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.boycott_campaigns(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_user_campaign_prefs_user_id ON public.user_campaign_preferences (user_id);

-- 5. product_boycott_matches
CREATE TABLE IF NOT EXISTS public.product_boycott_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID,
  campaign_id UUID NOT NULL REFERENCES public.boycott_campaigns(id) ON DELETE CASCADE,
  reason TEXT,
  source_url TEXT,
  verified_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Row Level Security (RLS)
ALTER TABLE public.boycott_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_campaign_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_boycott_matches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'boycott_campaigns' AND policyname = 'Public read boycott_campaigns'
  ) THEN
    CREATE POLICY "Public read boycott_campaigns" ON public.boycott_campaigns FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'campaign_targets' AND policyname = 'Public read campaign_targets'
  ) THEN
    CREATE POLICY "Public read campaign_targets" ON public.campaign_targets FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_relationships' AND policyname = 'Public read company_relationships'
  ) THEN
    CREATE POLICY "Public read company_relationships" ON public.company_relationships FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_boycott_matches' AND policyname = 'Public read product_boycott_matches'
  ) THEN
    CREATE POLICY "Public read product_boycott_matches" ON public.product_boycott_matches FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_campaign_preferences' AND policyname = 'Users manage own campaign preferences'
  ) THEN
    CREATE POLICY "Users manage own campaign preferences" ON public.user_campaign_preferences
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
