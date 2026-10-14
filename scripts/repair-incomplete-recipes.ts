import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { createAdminSupabaseClient } from '../lib/supabase-server';
import { RecipeInstructionNormalizer } from '../lib/services/recipes/RecipeInstructionNormalizer';

async function main() {
  const sb = createAdminSupabaseClient();
  console.log('--- REPAIRING INCOMPLETE RECIPES IN SUPABASE ---');

  // 1. Specifically repair the Rice and Beans recipe: 1b4d057c-c579-48b9-9a4a-f0c1dbec893f
  const { data: targetRecipe, error: fetchErr } = await sb
    .from('recipes')
    .select('*')
    .eq('id', '1b4d057c-c579-48b9-9a4a-f0c1dbec893f')
    .maybeSingle();

  if (targetRecipe) {
    console.log(`Found target recipe: "${targetRecipe.title}" (${targetRecipe.id})`);
    console.log(`Original instructions count:`, Array.isArray(targetRecipe.instructions) ? targetRecipe.instructions.length : typeof targetRecipe.instructions);
    console.log(`Original prep_time: ${targetRecipe.prep_time_minutes}, cook_time: ${targetRecipe.cook_time_minutes}`);

    const normalized = RecipeInstructionNormalizer.normalizeRecipeDetails(targetRecipe);

    console.log(`Normalized steps (${normalized.instructions.length} steps):`);
    normalized.instructions.forEach((step, i) => console.log(`  [Step ${i + 1}] ${step.slice(0, 80)}...`));
    console.log(`Normalized prep_time: ${normalized.prep_time_minutes} min, cook_time: ${normalized.cook_time_minutes} min, total: ${normalized.total_time_minutes} min`);

    const { error: updateErr } = await sb
      .from('recipes')
      .update({
        instructions: normalized.instructions,
        prep_time_minutes: normalized.prep_time_minutes,
        cook_time_minutes: normalized.cook_time_minutes,
        description: normalized.description
      })
      .eq('id', targetRecipe.id);

    if (updateErr) {
      console.error('Error updating target recipe:', updateErr);
    } else {
      console.log('✅ Target recipe successfully updated in Supabase `recipes` table!');
    }
  } else {
    console.warn('Target recipe 1b4d057c-c579-48b9-9a4a-f0c1dbec893f not found in recipes table, checking cached_recipes...');
  }

  // Also check if it exists in cached_recipes
  const { data: cachedTarget } = await sb
    .from('cached_recipes')
    .select('*')
    .or('id.eq.1b4d057c-c579-48b9-9a4a-f0c1dbec893f,title.ilike.%Rice and Beans%')
    .limit(5);

  if (cachedTarget && cachedTarget.length > 0) {
    for (const cr of cachedTarget) {
      const normalized = RecipeInstructionNormalizer.normalizeRecipeDetails(cr);
      await sb
        .from('cached_recipes')
        .update({
          instructions_steps: normalized.instructions,
          preparation_time: normalized.prep_time_minutes
        })
        .eq('id', cr.id);
      console.log(`✅ Cached recipe "${cr.title}" (${cr.id}) updated in cached_recipes.`);
    }
  }

  // 2. Scan and repair other recipes in `recipes` table with single-step or null timings
  const { data: candidates } = await sb
    .from('recipes')
    .select('id, title, ingredients, instructions, prep_time_minutes, cook_time_minutes, description')
    .limit(100);

  let repairedCount = 0;
  for (const r of candidates || []) {
    const inst = Array.isArray(r.instructions) ? r.instructions : (typeof r.instructions === 'string' ? [r.instructions] : []);
    if (inst.length === 1 || !r.prep_time_minutes || !r.cook_time_minutes) {
      const normalized = RecipeInstructionNormalizer.normalizeRecipeDetails(r);
      if (normalized.instructions.length > 1) {
        await sb
          .from('recipes')
          .update({
            instructions: normalized.instructions,
            prep_time_minutes: normalized.prep_time_minutes,
            cook_time_minutes: normalized.cook_time_minutes,
            description: normalized.description
          })
          .eq('id', r.id);
        repairedCount++;
      }
    }
  }

  console.log(`✅ Repaired ${repairedCount} additional single-step or untimed recipes in Supabase.`);
  console.log('--- REPAIR COMPLETE ---');
}

main().catch(console.error);
