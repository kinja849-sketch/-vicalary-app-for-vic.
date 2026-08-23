const { Client } = require('pg');

const connectionString = "postgresql://postgres:Alliswell1223@db.ifxrkbitnpbxqnbxkncp.supabase.co:5432/postgres";

async function run() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        await client.query("DELETE FROM public.institution_cache;");
        console.log("Successfully cleared institution_cache!");
    } catch (err) {
        console.error("Failed:", err);
    } finally {
        await client.end();
    }
}

run();
