const { Client } = require('pg');

const connectionString = "postgresql://postgres:Alliswell1223@db.ifxrkbitnpbxqnbxkncp.supabase.co:5432/postgres";

async function run() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log("Connected to Supabase DB");

    const today = new Date().toISOString().split('T')[0];
    console.log(`Deleting daily meal plans for date: ${today}`);

    const result = await client.query(`DELETE FROM user_daily_meal_plans WHERE plan_date = $1`, [today]);
    console.log(`Deleted ${result.rowCount} corrupted plans.`);

  } catch (err) {
    console.error("Failed:", err);
  } finally {
    await client.end();
  }
}

run();
