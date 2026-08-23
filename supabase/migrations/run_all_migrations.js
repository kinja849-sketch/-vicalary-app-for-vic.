const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = "postgresql://postgres:Alliswell1223@db.ifxrkbitnpbxqnbxkncp.supabase.co:5432/postgres";

const migrations = [
    '20240517_rls_and_fixes.sql',
    '20240518_system_logs_and_messages_fix.sql',
];

async function runMigrations() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log("Connected to Supabase DB\n");

        for (const migration of migrations) {
            const migrationPath = path.join(__dirname, migration);
            if (!fs.existsSync(migrationPath)) {
                console.warn(`SKIP (not found): ${migration}`);
                continue;
            }
            const sql = fs.readFileSync(migrationPath, 'utf8');
            console.log(`Running: ${migration}...`);
            try {
                await client.query(sql);
                console.log(`  ✓ SUCCESS: ${migration}\n`);
            } catch (err) {
                console.error(`  ✗ FAILED: ${migration}`);
                console.error(`    Error: ${err.message}\n`);
            }
        }

        console.log("All migrations completed.");
    } catch (err) {
        console.error("Connection failed:", err);
    } finally {
        await client.end();
    }
}

runMigrations();
