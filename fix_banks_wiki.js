const { Client } = require('pg');

const connectionString = "postgresql://postgres:Alliswell1223@db.ifxrkbitnpbxqnbxkncp.supabase.co:6543/postgres?pgbouncer=true";

async function run() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    await client.query(`DELETE FROM institution_cache WHERE country_code = 'ID';`);

    const rawBanks = [
        { institution_id: 'bca', name: 'BCA', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Bank_Central_Asia.svg', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'mandiri', name: 'Mandiri', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Bank_Mandiri_logo_2016.svg', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'bni', name: 'BNI', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Bank_Negara_Indonesia_logo_%282004%29.svg', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'cimb', name: 'CIMB', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/CIMB_Niaga_logo.svg', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'bri', name: 'BRI', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/BRI_2020.svg', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'danamon', name: 'Danamon', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Logo_Bank_Danamon.svg', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'permata', name: 'Permata', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/3/38/PermataBank_logo.svg', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'bsi', name: 'BSI', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Bank_Syariah_Indonesia.svg', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'maybank', name: 'Maybank', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Maybank_logo.svg', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'panin', name: 'Panin', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Logo_Panin_Bank.svg', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'ocbc', name: 'OCBC', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/0/07/OCBC_logo.svg', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'mega', name: 'Mega', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Bank_Mega_logo.svg', provider: 'brankas', country_code: 'ID' },
        { institution_id: 'btn', name: 'BTN', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Bank_Tabungan_Negara_logo.svg', provider: 'brankas', country_code: 'ID' }
    ];

    const values = rawBanks.map(b => 
        `('${b.institution_id}', '${b.name}', '${b.logo_url}', '${b.provider}', '${b.country_code}')`
    ).join(',');

    await client.query(`
        INSERT INTO institution_cache (institution_id, name, logo_url, provider, country_code)
        VALUES ${values}
    `);

    console.log("Inserted correct bank logos with Wikimedia SVGs.");

  } catch (err) {
    console.error("Failed:", err);
  } finally {
    await client.end();
  }
}

run();
