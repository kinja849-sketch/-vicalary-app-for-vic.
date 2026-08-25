const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = "postgresql://postgres:Alliswell1223@db.ifxrkbitnpbxqnbxkncp.supabase.co:5432/postgres";

async function runMigration() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log("Connected to Supabase DB");

        const migrationPath = path.join(__dirname, '20260524_user_banks.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log("Running migration...");
        await client.query(sql);
        console.log("Migration successful!");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await client.end();
    }
}

runMigration();
