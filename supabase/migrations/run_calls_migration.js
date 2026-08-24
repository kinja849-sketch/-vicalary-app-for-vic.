const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Force DNS lookup for db.ifxrkbitnpbxqnbxkncp.supabase.co to resolve to the IPv4 pooler IP
const originalLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  const cb = typeof options === 'function' ? options : callback;
  const opts = typeof options === 'object' ? options : {};
  if (hostname === 'db.ifxrkbitnpbxqnbxkncp.supabase.co') {
    if (opts.all) {
      return cb(null, [{ address: '52.74.252.201', family: 4 }]);
    }
    return cb(null, '52.74.252.201', 4);
  }
  return originalLookup.apply(this, arguments);
};

require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

// Use direct URL
const connectionString = process.env.DIRECT_URL;

async function run() {
  const client = new Client({
    connectionString,
    ssl: { 
      rejectUnauthorized: false,
      servername: 'db.ifxrkbitnpbxqnbxkncp.supabase.co'
    }
  });

  try {
    await client.connect();
    console.log("Connected to Supabase DB.");
    
    const migrationFile = '20260824_calls_rls_policies.sql';
    const sqlPath = path.join(__dirname, migrationFile);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log(`Running migration: ${migrationFile}...`);
    await client.query(sql);
    console.log("Migration executed successfully!");
    
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
