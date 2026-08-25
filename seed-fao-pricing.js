const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function seed() {
  try {
    await client.connect();
    
    // 1. Create food_indexes table (PPP / CPI relative to US=100)
    await client.query(`
      CREATE TABLE IF NOT EXISTS food_indexes (
        id SERIAL PRIMARY KEY,
        country_code VARCHAR(10) UNIQUE NOT NULL,
        country_name VARCHAR(255),
        cpi_value NUMERIC NOT NULL
      );
    `);
    
    // 2. Create reference_prices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reference_prices (
        id SERIAL PRIMARY KEY,
        category VARCHAR(255) UNIQUE NOT NULL,
        base_price NUMERIC NOT NULL,
        currency VARCHAR(10) NOT NULL,
        country_code VARCHAR(10) NOT NULL
      );
    `);
    
    // 3. Seed CPI data for all major regions (approximations based on World Bank PPP for food)
    // US = 100 base. Indonesia is relatively cheaper (approx 35% of US costs). 
    const cpiData = `
      INSERT INTO food_indexes (country_code, country_name, cpi_value) 
      VALUES 
        ('US', 'United States', 100),
        ('ID', 'Indonesia', 35),
        ('EG', 'Egypt', 25),
        ('GB', 'United Kingdom', 95),
        ('AU', 'Australia', 110),
        ('CA', 'Canada', 105),
        ('IN', 'India', 30),
        ('BR', 'Brazil', 45),
        ('ZA', 'South Africa', 50),
        ('MY', 'Malaysia', 40),
        ('AE', 'United Arab Emirates', 90),
        ('SA', 'Saudi Arabia', 85),
        ('NG', 'Nigeria', 35),
        ('DE', 'Germany', 95),
        ('FR', 'France', 98),
        ('JP', 'Japan', 105),
        ('MX', 'Mexico', 50)
      ON CONFLICT (country_code) DO UPDATE SET cpi_value = EXCLUDED.cpi_value;
    `;
    
    // 4. Seed baseline reference prices (Reference country: Indonesia)
    const refPrices = `
      INSERT INTO reference_prices (category, base_price, currency, country_code)
      VALUES
        ('Dairy', 20000, 'IDR', 'ID'),
        ('Beverages', 15000, 'IDR', 'ID'),
        ('Snacks', 12000, 'IDR', 'ID'),
        ('Cereals', 25000, 'IDR', 'ID'),
        ('Meat', 60000, 'IDR', 'ID'),
        ('Produce', 15000, 'IDR', 'ID'),
        ('General', 20000, 'IDR', 'ID')
      ON CONFLICT (category) DO UPDATE SET base_price = EXCLUDED.base_price;
    `;
    
    await client.query(cpiData);
    await client.query(refPrices);
    console.log('Successfully created and seeded FAO Pricing tables.');
    
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    await client.end();
  }
}

seed();
