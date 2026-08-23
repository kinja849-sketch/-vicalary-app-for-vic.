-- Add unique constraint to support UPSERT operations
ALTER TABLE user_recipe_interactions 
ADD CONSTRAINT user_recipe_interactions_unique_upsert UNIQUE (user_id, recipe_id, interaction_type);
