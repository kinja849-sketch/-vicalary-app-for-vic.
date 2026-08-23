const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function seed() {
  try {
    await client.connect();
    
    // Create boycott_brands table
    await client.query(`
      CREATE TABLE IF NOT EXISTS boycott_brands (
        id SERIAL PRIMARY KEY,
        parent_company_name VARCHAR(255) UNIQUE NOT NULL,
        countries_supported VARCHAR(255),
        detailed_reason TEXT
      );
    `);
    
    // Insert deterministic boycott data
    const seedData = `
      INSERT INTO boycott_brands (parent_company_name, countries_supported, detailed_reason) 
      VALUES 
        ('Coca-Cola', 'Israel, USA', 'Operates a factory in the illegal Israeli settlement of Atarot. Major US corporate affiliation.'),
        ('Nestle', 'Israel', 'Owns Osem, a major Israeli food manufacturer.'),
        ('Kraft Heinz', 'Israel, USA', 'Partners with Israeli military and tech incubators.'),
        ('PepsiCo', 'Israel, USA', 'Acquired SodaStream and operates extensively in Israel.'),
        ('Starbucks', 'Israel, USA', 'Sued its union for expressing solidarity with Palestine.'),
        ('McDonald''s', 'Israel, USA', 'Franchisees provided free meals to the Israeli military.'),
        ('Orang Tua', 'UAE', 'Corporate restructuring linking financial flows to UAE holdings.')
      ON CONFLICT (parent_company_name) DO NOTHING;
    `;
    
    await client.query(seedData);
    console.log('Successfully created and seeded boycott_brands table.');
    
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    await client.end();
  }
}

seed();
