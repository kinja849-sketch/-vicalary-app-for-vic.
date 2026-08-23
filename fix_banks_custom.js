const { Client } = require('pg');

const connectionString = "postgresql://postgres:Alliswell1223@db.ifxrkbitnpbxqnbxkncp.supabase.co:6543/postgres?pgbouncer=true";

async function run() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    await client.query(`DELETE FROM institution_cache WHERE country_code = 'ID';`);

    const rawBanks = [
        { institution_id: 'bca', name: 'BCA', logo_url: '/custom-logos/bank-central-asia-(bca)-logo.svg', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'mandiri', name: 'Mandiri', logo_url: '/custom-logos/bank-mandiri-logo.png', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'bni', name: 'BNI', logo_url: '/custom-logos/bank-negara-indonesia-(bni)-logo.png', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'cimb', name: 'CIMB', logo_url: '/custom-logos/bank-cimb-niaga-logo.svg', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'bri', name: 'BRI', logo_url: '/custom-logos/bank-rakyat-indonesia-(bri)-logo.svg', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'danamon', name: 'Danamon', logo_url: '/custom-logos/bank-danamon-logo.svg', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'permata', name: 'Permata', logo_url: '/custom-logos/bank-permata-logo.png', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'bsi', name: 'BSI', logo_url: '/custom-logos/bank-bsi-logo.svg', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'maybank', name: 'Maybank', logo_url: '/custom-logos/maybank-logo.png', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'panin', name: 'Panin', logo_url: '/api/banking/logo?domain=panin.co.id', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'ocbc', name: 'OCBC', logo_url: '/api/banking/logo?domain=ocbc.id', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'mega', name: 'Mega', logo_url: '/api/banking/logo?domain=bankmega.com', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'btn', name: 'BTN', logo_url: '/api/banking/logo?domain=btn.co.id', provider: 'brankas', country_code: 'ID' }
    ];

    const values = rawBanks.map(b => 
        `('${b.institution_id}', '${b.name}', '${b.logo_url}', '${b.provider}', '${b.country_code}')`
    ).join(',');

    await client.query(`
        INSERT INTO institution_cache (institution_id, name, logo_url, provider, country_code)
        VALUES ${values}
    `);

    console.log("Inserted custom GitHub logos.");

  } catch (err) {
    console.error("Failed:", err);
  } finally {
    await client.end();
  }
}

run();
