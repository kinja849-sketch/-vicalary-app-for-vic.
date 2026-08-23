const { Client } = require('pg');

const connectionString = "postgresql://postgres:Alliswell1223@db.ifxrkbitnpbxqnbxkncp.supabase.co:6543/postgres?pgbouncer=true";

async function run() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    // We will clear the existing ID country cache and insert correct ones
    await client.query(`DELETE FROM institution_cache WHERE country_code = 'ID';`);
    
    const fav = (domain) => `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=128`;

    const rawBanks = [
        { institution_id: 'bca', name: 'BCA', logo_url: fav('bca.co.id'), provider: 'brankas', country_code: 'ID' },
        { institution_id: 'mandiri', name: 'Mandiri', logo_url: fav('bankmandiri.co.id'), provider: 'brankas', country_code: 'ID' },
        { institution_id: 'bni', name: 'BNI', logo_url: fav('bni.co.id'), provider: 'brankas', country_code: 'ID' },
        { institution_id: 'cimb', name: 'CIMB', logo_url: fav('cimbniaga.co.id'), provider: 'brankas', country_code: 'ID' },
        { institution_id: 'bri', name: 'BRI', logo_url: fav('bri.co.id'), provider: 'brankas', country_code: 'ID' },
        { institution_id: 'danamon', name: 'Danamon', logo_url: fav('danamon.co.id'), provider: 'brankas', country_code: 'ID' },
        { institution_id: 'permata', name: 'Permata', logo_url: fav('permatabank.com'), provider: 'brankas', country_code: 'ID' },
        { institution_id: 'bsi', name: 'BSI', logo_url: fav('bankbsi.co.id'), provider: 'brankas', country_code: 'ID' },
        { institution_id: 'maybank', name: 'Maybank', logo_url: fav('maybank.co.id'), provider: 'brankas', country_code: 'ID' },
        { institution_id: 'panin', name: 'Panin', logo_url: fav('panin.co.id'), provider: 'brankas', country_code: 'ID' },
        { institution_id: 'ocbc', name: 'OCBC', logo_url: fav('ocbc.id'), provider: 'brankas', country_code: 'ID' },
        { institution_id: 'mega', name: 'Mega', logo_url: fav('bankmega.com'), provider: 'brankas', country_code: 'ID' },
        { institution_id: 'btn', name: 'BTN', logo_url: fav('btn.co.id'), provider: 'brankas', country_code: 'ID' }
    ];

    const values = rawBanks.map(b => 
        `('${b.institution_id}', '${b.name}', '${b.logo_url}', '${b.provider}', '${b.country_code}')`
    ).join(',');

    await client.query(`
        INSERT INTO institution_cache (institution_id, name, logo_url, provider, country_code)
        VALUES ${values}
    `);

    console.log("Inserted correct bank logos with Google Favicon.");

  } catch (err) {
    console.error("Failed:", err);
  } finally {
    await client.end();
  }
}

run();
