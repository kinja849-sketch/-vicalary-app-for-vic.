const { Client } = require('pg');

const connectionString = "postgresql://postgres:Alliswell1223@db.ifxrkbitnpbxqnbxkncp.supabase.co:6543/postgres?pgbouncer=true";

async function run() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log("Connected to Supabase DB");

    // Create cached_recipes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS cached_recipes (
        id VARCHAR PRIMARY KEY,
        title VARCHAR NOT NULL,
        image_url VARCHAR,
        ingredients JSONB DEFAULT '[]',
        instructions_steps JSONB DEFAULT '[]',
        nutrition JSONB DEFAULT '{}',
        cuisine_region VARCHAR,
        preparation_time INTEGER DEFAULT 30,
        meal_type VARCHAR,
        health_goal VARCHAR,
        budget_category VARCHAR,
        provider VARCHAR,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
      );
    `);
    console.log("Created cached_recipes table.");

    // Create or update institution_cache table
    await client.query(`
      CREATE TABLE IF NOT EXISTS institution_cache (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        logo_url TEXT,
        brand_color VARCHAR,
        provider VARCHAR NOT NULL,
        country_code VARCHAR,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
      );
    `);
    console.log("Created institution_cache table.");

    // Update user_recipe_interactions
    // Add columns if they don't exist
    await client.query(`
      ALTER TABLE user_recipe_interactions
      ADD COLUMN IF NOT EXISTS dismissed BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS shown BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS skipped BOOLEAN DEFAULT FALSE;
    `);
    console.log("Updated user_recipe_interactions.");

  } catch (err) {
    console.error("Failed:", err);
  } finally {
    await client.end();
  }
}

run();
