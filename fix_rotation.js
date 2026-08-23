const { Client } = require('pg');

const connectionString = "postgresql://postgres:Alliswell1223@db.ifxrkbitnpbxqnbxkncp.supabase.co:6543/postgres?pgbouncer=true";

async function run() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log("Connected to Supabase DB");

    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_meal_served (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        meal_id VARCHAR NOT NULL,
        shown_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
        liked BOOLEAN DEFAULT FALSE,
        dismissed BOOLEAN DEFAULT FALSE,
        UNIQUE(user_id, meal_id)
      );
    `);
    console.log("Created daily_meal_served table.");

  } catch (err) {
    console.error("Failed:", err);
  } finally {
    await client.end();
  }
}

run();
