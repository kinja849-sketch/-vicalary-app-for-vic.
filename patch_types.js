const fs = require('fs');
let c = fs.readFileSync('lib/database.types.ts', 'utf8');

const tablesToAdd = \
      financial_transactions: {
        Row: { id: string; user_id: string; amount: number; }
        Insert: { id?: string; user_id: string; amount: number; [key: string]: any }
        Update: { id?: string; user_id?: string; amount?: number; [key: string]: any }
      }
      bank_connections: {
        Row: { id: string; user_id: string; provider: string; }
        Insert: { id?: string; user_id: string; provider: string; [key: string]: any }
        Update: { id?: string; user_id?: string; provider?: string; [key: string]: any }
      }
      user_financial_regions: {
        Row: { id: string; user_id: string; country_code: string; }
        Insert: { id?: string; user_id: string; country_code: string; [key: string]: any }
        Update: { id?: string; user_id?: string; country_code?: string; [key: string]: any }
      }
      user_budget_profiles: {
        Row: { id: string; user_id: string; monthly_budget: number; }
        Insert: { id?: string; user_id: string; monthly_budget: number; [key: string]: any }
        Update: { id?: string; user_id?: string; monthly_budget?: number; [key: string]: any }
      }
      product_price_cache: {
        Row: { product_id: string; price: number; }
        Insert: { product_id: string; price: number; [key: string]: any }
        Update: { product_id?: string; price?: number; [key: string]: any }
      }
\;

c = c.replace('Tables: {', 'Tables: {' + tablesToAdd);
fs.writeFileSync('lib/database.types.ts', c);
console.log('Patched types');
