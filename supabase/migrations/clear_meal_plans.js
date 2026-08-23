const { Client } = require('pg');

const connectionString = "postgresql://postgres:Alliswell1223@db.ifxrkbitnpbxqnbxkncp.supabase.co:5432/postgres";

async function run() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log("Connected to Supabase DB");

        console.log("Deleting old meal plans to force regeneration...");
        await client.query("DELETE FROM public.user_daily_meal_plans;");
        console.log("Old meal plans deleted successfully!");
    } catch (err) {
        console.error("Failed:", err);
    } finally {
        await client.end();
    }
}

run();
