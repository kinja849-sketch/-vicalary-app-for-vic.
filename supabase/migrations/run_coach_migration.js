const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const connectionString = "postgresql://postgres:Alliswell1223@db.ifxrkbitnpbxqnbxkncp.supabase.co:5432/postgres";

async function runMigration() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log("Connected to Supabase DB");

    const sqlPath = path.join(__dirname, '20260525_coach_chat_handoff.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Executing migration...");
    await client.query(sql);
    console.log("Migration executed successfully!");

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

runMigration();
