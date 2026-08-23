const { Client } = require('pg');

const connectionString = "postgresql://postgres:Alliswell1223@db.ifxrkbitnpbxqnbxkncp.supabase.co:6543/postgres?pgbouncer=true";

async function run() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'institution_cache';
    `);
    console.log(res.rows);

  } catch (err) {
    console.error("Failed:", err);
  } finally {
    await client.end();
  }
}

run();
