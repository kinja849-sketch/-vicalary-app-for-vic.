const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanup() {
  console.log("🧹 Starting database cleanup...");

  // 1. Delete all old generated plans
  console.log("Removing contaminated daily meal plans...");
  const { error: planErr } = await supabase
    .from('user_daily_meal_plans')
    .delete()
    .neq('user_id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
    
  if (planErr) {
    console.error("Failed to delete meal plans:", planErr);
  } else {
    console.log("✅ Cleared user_daily_meal_plans");
  }

  // 2. Delete recipes with Unsplash images (they are AI generated)
  console.log("Removing AI generated recipes with Unsplash stock photos...");
  const { error: recipeErr } = await supabase
    .from('recipes')
    .delete()
    .like('image_url', '%source.unsplash.com%');

  if (recipeErr) {
    console.error("Failed to delete contaminated recipes:", recipeErr);
  } else {
    console.log("✅ Cleared contaminated recipes");
  }

  console.log("🎉 Cleanup complete!");
}

cleanup();
