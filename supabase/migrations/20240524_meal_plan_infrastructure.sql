-- Migration: Meal Plan Infrastructure
-- Date: 2024-05-24

-- Create table to robustly cache daily meal plans
CREATE TABLE IF NOT EXISTS user_daily_meal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_date DATE NOT NULL DEFAULT CURRENT_DATE,
    breakfast JSONB DEFAULT '[]'::jsonb,
    lunch JSONB DEFAULT '[]'::jsonb,
    dinner JSONB DEFAULT '[]'::jsonb,
    snacks JSONB DEFAULT '[]'::jsonb,
    drinks JSONB DEFAULT '[]'::jsonb,
    desserts JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure a user only has one active plan per date
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_daily_meal_plans_user_date_idx') THEN
        ALTER TABLE user_daily_meal_plans ADD CONSTRAINT user_daily_meal_plans_user_date_idx UNIQUE (user_id, plan_date);
    END IF;
END $$;

-- Enable RLS
ALTER TABLE user_daily_meal_plans ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view and manage their own meal plans
DROP POLICY IF EXISTS "Users can manage their own meal plans" ON user_daily_meal_plans;
CREATE POLICY "Users can manage their own meal plans" 
ON user_daily_meal_plans 
FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_meal_plan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_meal_plan_updated_at_trigger ON user_daily_meal_plans;
CREATE TRIGGER update_meal_plan_updated_at_trigger
BEFORE UPDATE ON user_daily_meal_plans
FOR EACH ROW
EXECUTE FUNCTION update_meal_plan_updated_at();
