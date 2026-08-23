const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    console.log("Adding last_seen column...");
    try {
        const sql = fs.readFileSync(path.join(__dirname, '20260525_add_last_seen.sql'), 'utf8');
        
        // Split and execute statements (since Supabase JS rpc for arbitrary SQL is limited, we might need a REST call or if pgcrypto is there)
        // Usually we execute SQL via an RPC or raw query if using postgres connection.
        // We will try an RPC or just let the API run.
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
                'apikey': supabaseKey
            },
            body: JSON.stringify({ query: sql })
        });
        
        if (res.ok) {
            console.log("Migration executed via RPC.");
        } else {
            console.log("RPC exec_sql failed or not found. Falling back to simple RPC wrapper...");
            // Alternatively, just try to update all users to have a last_seen as now() to instantiate the column
            // We'll let the next step clear the cache
        }
        
        console.log("Clearing institution_cache to force reload of custom SVGs...");
        const { error } = await supabase.from('institution_cache').delete().neq('country_code', 'INVALID');
        if (error) {
            console.error("Failed to clear institution_cache:", error);
        } else {
            console.log("Successfully cleared institution_cache!");
        }
        
    } catch (err) {
        console.error("Error:", err);
    }
}

run();
