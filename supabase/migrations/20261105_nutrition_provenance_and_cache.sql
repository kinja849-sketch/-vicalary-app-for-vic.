-- Migration: 20261105_nutrition_provenance_and_cache.sql
-- Purpose: Add authoritative nutrition reference cache (Open Food Facts v3, USDA FoodData Central, TKPI 2020)
-- and provenance/discrepancy audit columns on product_scan_history and meal_analyses.

CREATE TABLE IF NOT EXISTS public.nutrition_reference_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lookup_key text NOT NULL UNIQUE,
  workflow_type text NOT NULL CHECK (workflow_type IN ('packaged_product', 'nutrition_label_ocr', 'fresh_single_food', 'mixed_meal')),
  source_name text NOT NULL,
  source_api text NOT NULL,
  source_id text,
  origin_country text,
  shopping_market_country text,
  verification_status text NOT NULL CHECK (verification_status IN ('verified', 'database-derived', 'label-extracted', 'estimated', 'requires-confirmation', 'unavailable')),
  original_source_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  discrepancy_metadata jsonb,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_reference_cache_lookup_key
  ON public.nutrition_reference_cache (lookup_key);

CREATE INDEX IF NOT EXISTS idx_nutrition_reference_cache_source_id
  ON public.nutrition_reference_cache (source_api, source_id);

ALTER TABLE public.nutrition_reference_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'nutrition_reference_cache'
      AND policyname = 'Allow public read of nutrition_reference_cache'
  ) THEN
    CREATE POLICY "Allow public read of nutrition_reference_cache"
      ON public.nutrition_reference_cache
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Add provenance and discrepancy columns to product_scan_history if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_scan_history') THEN
    ALTER TABLE public.product_scan_history
      ADD COLUMN IF NOT EXISTS origin_country text,
      ADD COLUMN IF NOT EXISTS shopping_market_country text,
      ADD COLUMN IF NOT EXISTS verification_status text,
      ADD COLUMN IF NOT EXISTS original_source_values jsonb,
      ADD COLUMN IF NOT EXISTS calculated_consumption jsonb,
      ADD COLUMN IF NOT EXISTS discrepancy jsonb,
      ADD COLUMN IF NOT EXISTS provenance jsonb;
  END IF;
END $$;

