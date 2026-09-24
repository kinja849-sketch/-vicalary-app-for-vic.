const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to Supabase.");
    
    const sql = fs.readFileSync('supabase/migrations/20260830_budget_normalization.sql', 'utf8');
    
    console.log("Running budget normalization migration...");
    await client.query(sql);
    
    console.log("Migration executed successfully!");
    
    // Verify columns exist
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'user_budget_profiles' 
      AND column_name IN ('is_normalized', 'original_amount', 'original_currency', 'exchange_rate_used', 'exchange_rate_source', 'normalized_at')
      ORDER BY column_name
    `);
    
    console.log("\\nVerification - new columns:");
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
  } catch (err) {
    console.error("Migration Error:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

runMigration();
