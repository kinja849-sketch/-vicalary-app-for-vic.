const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = "postgresql://postgres:Alliswell1223@db.ifxrkbitnpbxqnbxkncp.supabase.co:5432/postgres";

async function runMigration() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log("Connected to Supabase DB\n");

        const migrationPath = path.join(__dirname, '20260525_cascade_delete.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        console.log(`Running cascade delete migration...`);
        await client.query(sql);
        console.log(`  ✓ SUCCESS: Trigger added successfully!\n`);

    } catch (err) {
        console.error("Connection failed or query error:", err);
    } finally {
        await client.end();
    }
}

runMigration();
