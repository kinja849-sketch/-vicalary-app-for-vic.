const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function runSQL() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to Supabase.");
    
    const sql = fs.readFileSync('setup_cron.sql', 'utf8');
    
    // We run it query by query or just passing the whole string.
    // Wait, the block with $$ might need to be run together.
    console.log("Running SQL...");
    await client.query(sql);
    
    console.log("SQL executed successfully!");
  } catch (err) {
    console.error("SQL Error:", err);
  } finally {
    await client.end();
  }
}

runSQL();
