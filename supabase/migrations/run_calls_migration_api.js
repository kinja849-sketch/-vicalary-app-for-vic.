const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ifxrkbitnpbxqnbxkncp.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmeHJrYml0bnBieHFuYnhrbmNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTIwMTcyNiwiZXhwIjoyMDg0Nzc3NzI2fQ.mRR1OdXmNm0wPsmU3nho1udQ4Pn4BorPG1z1eRfV6sg';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  try {
    const migrationFile = '20260824_calls_rls_policies.sql';
    const sqlPath = path.join(__dirname, migrationFile);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log(`Executing migration ${migrationFile} via HTTPS RPC 'exec_sql'...`);
    
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      throw error;
    }

    console.log("Migration executed successfully over HTTPS!");
    console.log("Result:", data);
    
  } catch (err) {
    console.error("Migration failed:", err.message || err);
  }
}

run();
