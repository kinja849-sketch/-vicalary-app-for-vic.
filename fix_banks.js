const { Client } = require('pg');

const connectionString = "postgresql://postgres:Alliswell1223@db.ifxrkbitnpbxqnbxkncp.supabase.co:6543/postgres?pgbouncer=true";

async function run() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log("Connected to Supabase DB");

    // We will clear the existing ID country cache and insert correct ones
    await client.query(`DELETE FROM institution_cache WHERE country_code = 'ID';`);
    console.log("Cleared old ID institutions from cache.");

    const rawBanks = [
        { id: 'bca', name: 'BCA', logo_url: 'https://logo.clearbit.com/bca.co.id', provider: 'brankas', country_code: 'ID' },
        { id: 'mandiri', name: 'Mandiri', logo_url: 'https://logo.clearbit.com/bankmandiri.co.id', provider: 'brankas', country_code: 'ID' },
        { id: 'bni', name: 'BNI', logo_url: 'https://logo.clearbit.com/bni.co.id', provider: 'brankas', country_code: 'ID' },
        { id: 'cimb', name: 'CIMB', logo_url: 'https://logo.clearbit.com/cimbniaga.co.id', provider: 'brankas', country_code: 'ID' },
        { id: 'bri', name: 'BRI', logo_url: 'https://logo.clearbit.com/bri.co.id', provider: 'brankas', country_code: 'ID' },
        { id: 'danamon', name: 'Danamon', logo_url: 'https://logo.clearbit.com/danamon.co.id', provider: 'brankas', country_code: 'ID' },
        { id: 'permata', name: 'Permata', logo_url: 'https://logo.clearbit.com/permatabank.com', provider: 'brankas', country_code: 'ID' },
        { id: 'bsi', name: 'BSI', logo_url: 'https://logo.clearbit.com/bankbsi.co.id', provider: 'brankas', country_code: 'ID' },
        { id: 'maybank', name: 'Maybank', logo_url: 'https://logo.clearbit.com/maybank.co.id', provider: 'brankas', country_code: 'ID' },
        { id: 'panin', name: 'Panin', logo_url: 'https://logo.clearbit.com/panin.co.id', provider: 'brankas', country_code: 'ID' },
        { id: 'ocbc', name: 'OCBC', logo_url: 'https://logo.clearbit.com/ocbc.id', provider: 'brankas', country_code: 'ID' },
        { id: 'mega', name: 'Mega', logo_url: 'https://logo.clearbit.com/bankmega.com', provider: 'brankas', country_code: 'ID' },
        { id: 'btn', name: 'BTN', logo_url: 'https://logo.clearbit.com/btn.co.id', provider: 'brankas', country_code: 'ID' }
    ];

    const values = rawBanks.map(b => 
        `('${b.id}', '${b.name}', '${b.logo_url}', '${b.provider}', '${b.country_code}')`
    ).join(',');

    await client.query(`
        INSERT INTO institution_cache (id, name, logo_url, provider, country_code)
        VALUES ${values}
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            logo_url = EXCLUDED.logo_url,
            provider = EXCLUDED.provider,
            country_code = EXCLUDED.country_code;
    `);

    console.log("Inserted correct bank logos with Clearbit.");

  } catch (err) {
    console.error("Failed:", err);
  } finally {
    await client.end();
  }
}

run();
