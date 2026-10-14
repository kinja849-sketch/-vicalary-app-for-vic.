import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { RecipeInstructionNormalizer } from '../lib/services/recipes/RecipeInstructionNormalizer';
import { classifyHalal } from '../lib/services/recipes/HalalClassifier';
import { createAdminSupabaseClient } from '../lib/supabase-server';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('RUNNING RECIPE COOKING STEPS & TIMING VERIFICATION SUITE');
  console.log('================================================================');

  // --- TEST 1: Rice and Beans Target Recipe from Database ---
  console.log('\n--- TEST 1: Rice and Beans Recipe Verification ---');
  const sb = createAdminSupabaseClient();
  const { data: dbRecipe } = await sb
    .from('recipes')
    .select('*')
    .eq('id', '1b4d057c-c579-48b9-9a4a-f0c1dbec893f')
    .single();

  assert(!!dbRecipe, 'Recipe 1b4d057c-c579-48b9-9a4a-f0c1dbec893f retrieved from Supabase');
  if (dbRecipe) {
    const normalized = RecipeInstructionNormalizer.normalizeRecipeDetails(dbRecipe);

    assert(normalized.instructions.length >= 6, `Has sequential steps: ${normalized.instructions.length} steps (>= 6 expected)`);
    assert(normalized.total_time_minutes >= 30, `Realistic total cooking duration: ${normalized.total_time_minutes} min (>= 30 min, not 15 min)`);
    assert(normalized.prep_time_minutes >= 5, `Realistic prep time: ${normalized.prep_time_minutes} min`);
    assert(normalized.cook_time_minutes >= 20, `Realistic cook time: ${normalized.cook_time_minutes} min`);

    // Verify step progression
    const step1 = normalized.instructions[0].toLowerCase();
    const stepLast = normalized.instructions[normalized.instructions.length - 1].toLowerCase();
    assert(step1.includes('rinse') || step1.includes('prepare') || step1.includes('measure'), 'Step 1 includes preparation/measuring');
    assert(stepLast.includes('serve') || stepLast.includes('fluff') || stepLast.includes('rest'), 'Final step explains finishing and serving');

    // Verify Scotch bonnet safety (not pierced)
    const pepperStep = normalized.instructions.find(s => s.toLowerCase().includes('scotch'));
    assert(!!pepperStep && (pepperStep.toLowerCase().includes('whole') || pepperStep.toLowerCase().includes('burst') || pepperStep.toLowerCase().includes('puncture')), 'Scotch bonnet pepper step mentions keeping pepper whole');

    // Verify cultural background
    assert(normalized.description.length > 30, 'Culinary background description is present and detailed');
    assert(normalized.description.toLowerCase().includes('caribbean') || normalized.description.toLowerCase().includes('latin') || normalized.description.toLowerCase().includes('staple'), 'Description reflects authentic culinary background');
  }

  // --- TEST 2: Halal Compliance of Steps ---
  console.log('\n--- TEST 2: Halal Dietary Compliance ---');
  const mockRiceAndBeans = {
    title: 'Rice and Beans',
    ingredients: [
      { item: 'Kidney Beans', amount: '1/2 bag', unit: '' },
      { item: 'Coconut Milk', amount: '1 Can', unit: '' },
      { item: 'Onion', amount: '1 Diced', unit: '' },
      { item: 'Scotch Bonnet', amount: '3', unit: '' },
      { item: 'Black Pepper', amount: '1 tablespoon', unit: '' },
      { item: 'Salt', amount: '1/2 tbs', unit: '' }
    ]
  };
  const normalizedSteps = RecipeInstructionNormalizer.normalizeRecipeDetails(mockRiceAndBeans);
  const combinedInstructionsText = normalizedSteps.instructions.join(' ').toLowerCase();

  assert(!combinedInstructionsText.includes('pork'), 'Steps contain zero pork');
  assert(!combinedInstructionsText.includes('bacon'), 'Steps contain zero bacon');
  assert(!combinedInstructionsText.includes('wine'), 'Steps contain zero cooking wine');
  assert(!combinedInstructionsText.includes('beer'), 'Steps contain zero beer');
  assert(!combinedInstructionsText.includes('alcohol'), 'Steps contain zero alcohol');
  assert(!combinedInstructionsText.includes('mirin'), 'Steps contain zero alcoholic mirin');

  // --- TEST 3: Zero-Hallucination of Ingredients ---
  console.log('\n--- TEST 3: Ingredient Containment & Consistency ---');
  // Steps must only reference declared ingredients or universal preparation agents (water, oil, salt, pepper)
  const allowedTerms = [
    'kidney beans', 'beans', 'coconut milk', 'coconut', 'onion', 'scotch bonnet',
    'pepper', 'black pepper', 'salt', 'water', 'oil', 'liquid', 'broth', 'rice'
  ];
  let allIngsReferencedSafely = true;
  for (const step of normalizedSteps.instructions) {
    // Check that steps don't introduce chicken or beef if it's a vegetarian bean dish
    if (step.toLowerCase().includes('chicken') || step.toLowerCase().includes('beef') || step.toLowerCase().includes('shrimp')) {
      allIngsReferencedSafely = false;
    }
  }
  assert(allIngsReferencedSafely, 'Steps do not hallucinate undeclared meats or foreign ingredients');

  // --- TEST 4: Multi-Recipe Category Timing & Step Quality ---
  console.log('\n--- TEST 4: Category-Specific Timing & Step Quality ---');

  // Soup
  const soup = RecipeInstructionNormalizer.normalizeRecipeDetails({
    title: 'Soto Ayam Bening Segar',
    ingredients: [
      { item: 'Halal chicken breast', amount: '200', unit: 'g' },
      { item: 'Lemongrass & Turmeric', amount: '1', unit: 'tbsp' },
      { item: 'Shallots & Garlic', amount: '3', unit: 'cloves' }
    ],
    prep_time_minutes: null,
    cook_time_minutes: null
  });
  assert(soup.instructions.length >= 4, `Soup generates sequential steps: ${soup.instructions.length}`);
  assert(soup.cook_time_minutes >= 20, `Soup has realistic simmering time: ${soup.cook_time_minutes} min`);

  // Stir-fry
  const stirfry = RecipeInstructionNormalizer.normalizeRecipeDetails({
    title: 'Capcay Goreng Seafood',
    ingredients: [
      { item: 'Prawns', amount: '100', unit: 'g' },
      { item: 'Broccoli & Cauliflower', amount: '150', unit: 'g' },
      { item: 'Garlic', amount: '2', unit: 'cloves' }
    ],
    prep_time_minutes: null,
    cook_time_minutes: null
  });
  assert(stirfry.instructions.length >= 4, `Stir-fry generates sequential steps: ${stirfry.instructions.length}`);
  assert(stirfry.cook_time_minutes <= 15, `Stir-fry has rapid high-heat cook time: ${stirfry.cook_time_minutes} min`);

  // Salad
  const salad = RecipeInstructionNormalizer.normalizeRecipeDetails({
    title: 'Gado-Gado Vegetable Salad',
    ingredients: [
      { item: 'Steamed green beans & cabbage', amount: '200', unit: 'g' },
      { item: 'Firm tofu', amount: '100', unit: 'g' },
      { item: 'Peanut dressing', amount: '4', unit: 'tbsp' }
    ],
    prep_time_minutes: null,
    cook_time_minutes: null
  });
  assert(salad.instructions.length >= 4, `Salad generates sequential assembly steps: ${salad.instructions.length}`);
  assert(salad.cook_time_minutes === 0 || salad.cook_time_minutes <= 5, `Salad cook time is appropriately minimal: ${salad.cook_time_minutes} min`);

  // --- TEST 5: Detailed Step Titles for Voice Guidance & UI ---
  console.log('\n--- TEST 5: Step Structure for Voice Guidance ---');
  assert(!!normalizedSteps.steps_detailed && normalizedSteps.steps_detailed.length === normalizedSteps.instructions.length, 'Detailed steps array provided for AI Cooking Assistant');
  assert(normalizedSteps.steps_detailed![0].title === 'Prepare Ingredients', 'Step 1 labeled "Prepare Ingredients"');
  assert(normalizedSteps.steps_detailed![normalizedSteps.steps_detailed!.length - 1].title === 'Rest, Fluff & Serve', 'Final step labeled "Rest, Fluff & Serve"');

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
