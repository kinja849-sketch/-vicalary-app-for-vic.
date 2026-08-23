-- 1. Ensure recipes table exists with standard columns
CREATE TABLE IF NOT EXISTS public.recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spoonacular_id BIGINT UNIQUE, -- Legacy support
    external_id TEXT UNIQUE, -- Unified ID (e.g., 'spoonacular_123', 'edamam_abc')
    provider TEXT, -- 'spoonacular', 'edamam', 'themealdb', 'internal'
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    cuisine_type TEXT, -- Region/Cuisine
    difficulty TEXT,
    dietary_tags JSONB DEFAULT '[]'::jsonb, -- e.g., ["halal", "vegan"]
    ingredients JSONB DEFAULT '[]'::jsonb, -- e.g., [{"item": "chicken", "amount": 1, "unit": "kg"}]
    instructions JSONB DEFAULT '[]'::jsonb, -- e.g., ["step 1", "step 2"]
    prep_time_minutes INTEGER DEFAULT 0,
    cook_time_minutes INTEGER DEFAULT 0,
    total_calories INTEGER DEFAULT 0,
    protein_g INTEGER DEFAULT 0,
    carbs_g INTEGER DEFAULT 0,
    fat_g INTEGER DEFAULT 0,
    estimated_cost DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add columns safely if table already existed but was missing them
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE public.recipes ADD COLUMN external_id TEXT UNIQUE;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.recipes ADD COLUMN provider TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.recipes ADD COLUMN estimated_cost DECIMAL(10,2) DEFAULT 0.00;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;
