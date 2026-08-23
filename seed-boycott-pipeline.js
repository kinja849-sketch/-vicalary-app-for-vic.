const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function seed() {
  try {
    await client.connect();
    
    // 1. Pipeline 1: Authoritative Sources
    await client.query(`
      CREATE TABLE IF NOT EXISTS boycott_sources (
        id SERIAL PRIMARY KEY,
        source_name VARCHAR(255) NOT NULL,
        parent_company VARCHAR(255) UNIQUE NOT NULL,
        reason_for_boycott TEXT NOT NULL,
        countries_supported VARCHAR(255),
        last_verified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // 2. Pipeline 2: Corporate Entities (Brand -> Parent Mapping)
    await client.query(`
      CREATE TABLE IF NOT EXISTS corporate_entities (
        id SERIAL PRIMARY KEY,
        brand_name VARCHAR(255) UNIQUE NOT NULL,
        parent_company VARCHAR(255) NOT NULL
      );
    `);
    
    // 3. Pipeline 3: Crowdsourced Submissions
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_submissions (
        id SERIAL PRIMARY KEY,
        barcode VARCHAR(255),
        product_name VARCHAR(255) NOT NULL,
        brand_name VARCHAR(255) NOT NULL,
        country_code VARCHAR(10),
        submitted_by_user_id UUID,
        photos_url TEXT,
        verification_status VARCHAR(50) DEFAULT 'pending',
        moderator_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // 4. Master Cache: Boycotted Products
    await client.query(`
      CREATE TABLE IF NOT EXISTS boycotted_products (
        id SERIAL PRIMARY KEY,
        barcode VARCHAR(255) UNIQUE NOT NULL,
        product_name VARCHAR(255),
        brand_name VARCHAR(255),
        parent_company VARCHAR(255),
        boycott_status BOOLEAN NOT NULL,
        reason_for_boycott TEXT,
        source_of_information VARCHAR(255),
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Seed authoritative data (BDS / TechForPalestine)
    await client.query(`
      INSERT INTO boycott_sources (source_name, parent_company, reason_for_boycott, countries_supported) 
      VALUES 
        ('BDS Movement', 'Coca-Cola', 'Operates a factory in the illegal Israeli settlement of Atarot. Major US corporate affiliation.', 'Israel, USA'),
        ('BDS Movement', 'Nestle', 'Owns Osem, a major Israeli food manufacturer.', 'Israel'),
        ('Palestine Solidarity Campaign', 'Kraft Heinz', 'Partners with Israeli military and tech incubators.', 'Israel, USA'),
        ('TechForPalestine', 'PepsiCo', 'Acquired SodaStream and operates extensively in Israel.', 'Israel, USA'),
        ('BDS Movement', 'Starbucks', 'Sued its union for expressing solidarity with Palestine.', 'Israel, USA'),
        ('Ethical Consumer', 'McDonald''s', 'Franchisees provided free meals to the Israeli military.', 'Israel, USA'),
        ('Corporate Watch', 'Orang Tua', 'Corporate restructuring linking financial flows to UAE holdings.', 'UAE'),
        ('PharmWatch', 'Teva Pharmaceuticals', 'Major Israeli pharmaceutical manufacturer deeply integrated into state economy.', 'Israel'),
        ('PharmWatch', 'Pfizer', 'Extensive partnerships and preferential data-sharing agreements with the Israeli state.', 'Israel, USA')
      ON CONFLICT (parent_company) DO NOTHING;
    `);
    
    // Seed Corporate Brand Mapping (Examples)
    await client.query(`
      INSERT INTO corporate_entities (brand_name, parent_company)
      VALUES
        ('Sprite', 'Coca-Cola'),
        ('Fanta', 'Coca-Cola'),
        ('Dasani', 'Coca-Cola'),
        ('Osem', 'Nestle'),
        ('KitKat', 'Nestle'),
        ('Maggi', 'Nestle'),
        ('Nescafe', 'Nestle'),
        ('Lay''s', 'PepsiCo'),
        ('Doritos', 'PepsiCo'),
        ('Quaker', 'PepsiCo'),
        ('Heinz', 'Kraft Heinz'),
        ('Kraft', 'Kraft Heinz')
      ON CONFLICT (brand_name) DO NOTHING;
    `);
    
    console.log('Successfully created and seeded the 4-tier Boycott Pipeline tables.');
    
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    await client.end();
  }
}

seed();
