const { Client } = require('pg');

const connectionString = "postgresql://postgres:Alliswell1223@db.ifxrkbitnpbxqnbxkncp.supabase.co:5432/postgres";

async function run() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log("Connected to Supabase DB");

    const result = await client.query(`TRUNCATE TABLE institution_cache`);
    console.log(`Cleared institution_cache table.`);

  } catch (err) {
    console.error("Failed:", err);
  } finally {
    await client.end();
  }
}

run();
