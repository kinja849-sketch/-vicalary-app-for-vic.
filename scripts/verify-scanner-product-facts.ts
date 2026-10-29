import * as path from 'path';
import * as dotenv from 'dotenv';
import { FoodColoringService } from '../lib/products/FoodColoringService';
import { NutritionNormalizer } from '../lib/nutrition/NutritionNormalizer';
import { SafetyEngine } from '../lib/services/SafetyEngine';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runVerification() {
  console.log('=== 1. Deterministic Unit Gates Verification ===');

  // 1A. NutritionNormalizer must NOT invent category nutrition or fake ingredients
  const fakeMilk = NutritionNormalizer.resolvePackagedProductNutrition('Some Random Dairy Cheese', 'Dairy', '30g');
  assert(fakeMilk === null, 'NutritionNormalizer must not invent fake nutrition for generic dairy items');

  const plainWater = NutritionNormalizer.resolvePackagedProductNutrition('Natural Mineral Water', 'Waters', '500ml');
  assert(plainWater !== null && plainWater.calories === 0, 'Plain mineral water should deterministically resolve to 0 kcal');

  const fakeIngredients = NutritionNormalizer.resolvePackagedProductIngredients('Random Soda Cola', 'Beverages', 'Generic');
  assert(fakeIngredients === null, 'NutritionNormalizer must never fabricate fake ingredients');
  console.log('  [PASS] NutritionNormalizer zero-hallucination gate verified.');

  // 1B. FoodColoringService unknown vs verified_none vs verified_colorings
  const unknownColoring = FoodColoringService.analyze(null, []);
  assert(
    unknownColoring.status === 'unknown' && unknownColoring.is_unknown === true && unknownColoring.has_colorings === false,
    'Missing ingredients must produce status="unknown" and is_unknown=true'
  );

  const cleanColoring = FoodColoringService.analyze('Durum wheat semolina, water', []);
  assert(
    cleanColoring.status === 'verified_none' && !cleanColoring.is_unknown && cleanColoring.has_colorings === false,
    'Clean real ingredients must produce status="verified_none"'
  );

  const syntheticColoring = FoodColoringService.analyze(
    'Sugar, corn syrup, artificial flavor, Red #40, Yellow 5 Lake, E133',
    ['en:e129']
  );
  assert(
    syntheticColoring.status === 'verified_colorings' &&
      syntheticColoring.has_synthetic === true &&
      syntheticColoring.synthetic_colors.length >= 3,
    `Expected Red 40, Yellow 5, and Blue 1 to be detected, got: ${JSON.stringify(syntheticColoring.synthetic_colors)}`
  );
  console.log('  [PASS] FoodColoringService unknown / verified_none / synthetic detection verified.');

  // 1C. SafetyEngine allergen synonym groups & GoalFit
  const testSafetyAllergy = SafetyEngine.evaluateProductSafety(
    {
      name: 'Creamy Alfredo Sauce',
      ingredients: 'Water, heavy cream, whey protein concentrate, parmesan cheese, wheat flour, soy lecithin',
      allergens: ['milk', 'wheat', 'soybeans']
    },
    { calories: 380, protein: 5, carbohydrates: 18, fat: 32, sugar: 4, sodium_mg: 780, basis: 'serving' },
    {
      userId: 'test-user',
      userGoal: 'Weight Loss',
      dailyCalorieGoal: 1600,
      allergies: ['dairy', 'gluten', 'soy'],
      medicalConditions: ['hypertension'],
      dietaryLifestyle: [],
      isDiabetic: false,
      hasHypertension: true,
      language: 'en'
    }
  );
  assert(!testSafetyAllergy.isSafe, 'SafetyEngine must flag product when user has dairy/gluten/soy allergies');
  assert(testSafetyAllergy.verdict === 'POOR', 'SafetyEngine verdict must be POOR on allergy match');
  assert(
    testSafetyAllergy.matchedAllergens?.includes('milk / dairy') &&
      testSafetyAllergy.matchedAllergens?.includes('wheat / gluten') &&
      testSafetyAllergy.matchedAllergens?.includes('soy'),
    `Expected milk/dairy, wheat/gluten, and soy to be matched, got: ${JSON.stringify(testSafetyAllergy.matchedAllergens)}`
  );
  assert(
    (testSafetyAllergy.medicalWarnings?.length || 0) > 0,
    'Expected hypertension high-sodium warning to be triggered for 780mg sodium'
  );
  console.log('  [PASS] SafetyEngine allergen synonym matching, hypertension gate, and GoalFit verified.');

  console.log('\n=== 2. Live HTTP Endpoint Verification (/api/analyze-product-barcode) ===');
  const baseUrl = 'http://localhost:8080';

  // 2A. Non-boycotted known barcode: Barilla Spaghetti n.5 (8076800195057)
  const barillaRes = await fetch(`${baseUrl}/api/analyze-product-barcode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      barcode: '8076800195057',
      userId: 'anon',
      language: 'en',
      locationContext: { country_code: 'US' },
      profileContext: {
        goal: 'Muscle Gain',
        daily_calorie_goal: 2400,
        allergies: []
      }
    })
  });
  assert(barillaRes.ok, `Expected 200 from /api/analyze-product-barcode for Barilla, got ${barillaRes.status}`);
  const barillaData = await barillaRes.json();
  console.log('  [Barilla 8076800195057]:', {
    status: barillaData.status,
    name: barillaData.name,
    brand: barillaData.brand,
    calories: barillaData.calories,
    protein: barillaData.protein,
    carbs: barillaData.carbs,
    fat: barillaData.fat,
    sodium_mg: barillaData.sodium_mg,
    serving_basis: barillaData.serving_basis,
    ingredients: barillaData.ingredients?.substring(0, 80),
    coloring: barillaData.coloring?.summary,
    goal_fit: barillaData.goal_fit,
    price_status: barillaData.price_metadata?.status,
    needs_user_price: barillaData.price_metadata?.needs_user_price
  });
  assert(barillaData.status === 'APPROVED', 'Barilla should be APPROVED');
  assert(Boolean(barillaData.brand && barillaData.brand.toLowerCase().includes('barilla')), 'Barilla brand must be resolved');
  assert(typeof barillaData.calories === 'number' && barillaData.calories > 0, 'Barilla calories must be numeric > 0');
  assert(typeof barillaData.protein === 'number' && barillaData.protein >= 10, 'Barilla protein must be numeric >= 10g');
  assert(!JSON.stringify(barillaData).includes('Calorie Data Pending'), 'Response must never contain "Calorie Data Pending"');
  assert(barillaData.description && barillaData.description.length >= 60, 'Barilla description must be substantive');
  assert(barillaData.goal_fit && barillaData.goal_fit.status === 'GOOD', 'Barilla (13g protein) should be GOOD fit for Muscle Gain');
  assert(typeof barillaData.price === 'number' && barillaData.price > 0, 'Barilla must have an automatic positive local price');
  assert(Boolean(barillaData.price_metadata?.price_range), 'Barilla must include an automatic local price_range');
  assert(barillaData.price_metadata?.needs_user_price === false, 'Barilla price must not require manual user self-entry');
  assert(barillaData.needs_crowdsourcing === false, 'needs_crowdsourcing must be false');
  assert(barillaData.political_warning === undefined, 'Approved products must not include an ethically cleared political_warning');

  // 2B. Same Barilla Spaghetti scanned by a user with a Wheat / Gluten allergy & Weight Loss goal
  const barillaAllergyRes = await fetch(`${baseUrl}/api/analyze-product-barcode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      barcode: '8076800195057',
      userId: 'anon',
      language: 'en',
      locationContext: { country_code: 'US' },
      profileContext: {
        goal: 'Weight Loss',
        daily_calorie_goal: 1500,
        allergies: ['wheat', 'gluten']
      }
    })
  });
  const barillaAllergyData = await barillaAllergyRes.json();
  console.log('  [Barilla with Wheat/Gluten Allergy]:', {
    is_safe_for_profile: barillaAllergyData.is_safe_for_profile,
    healthStatus: barillaAllergyData.healthStatus,
    matched_allergens: barillaAllergyData.matched_allergens,
    allergy_warnings: barillaAllergyData.allergy_warnings,
    goal_fit: barillaAllergyData.goal_fit
  });
  assert(barillaAllergyData.is_safe_for_profile === false, 'Barilla must be flagged unsafe for a user with wheat/gluten allergy');
  assert(barillaAllergyData.healthStatus === 'POOR', 'healthStatus must be POOR when allergen is matched');
  assert(barillaAllergyData.allergy_warnings?.length > 0, 'allergy_warnings must be non-empty');

  // 2C. Known barcode with sodium: Indomie Mi Goreng (089686010947) in Indonesia (ID / IDR)
  const indomieRes = await fetch(`${baseUrl}/api/analyze-product-barcode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      barcode: '089686010947',
      userId: 'anon',
      language: 'en',
      locationContext: { country_code: 'ID', currency: 'IDR' },
      profileContext: {
        goal: 'Weight Loss',
        daily_calorie_goal: 1600,
        allergies: []
      }
    })
  });
  const indomieData = await indomieRes.json();
  console.log('  [Indomie Mi Goreng 089686010947]:', {
    status: indomieData.status,
    name: indomieData.name,
    brand: indomieData.brand,
    calories: indomieData.calories,
    protein: indomieData.protein,
    carbs: indomieData.carbs,
    fat: indomieData.fat,
    sodium_mg: indomieData.sodium_mg,
    serving_basis: indomieData.serving_basis,
    ingredients_len: indomieData.ingredients?.length,
    coloring: indomieData.coloring,
    goal_fit: indomieData.goal_fit,
    price: indomieData.price,
    price_range: indomieData.price_metadata?.price_range,
    price_source: indomieData.price_metadata?.source
  });
  assert(indomieData.status === 'APPROVED', 'Indomie should be APPROVED');
  assert(typeof indomieData.calories === 'number' && indomieData.calories > 0, 'Indomie calories must be numeric > 0');
  assert(typeof indomieData.sodium_mg === 'number' && indomieData.sodium_mg > 100, `Indomie sodium_mg must be converted to mg (>100mg), got ${indomieData.sodium_mg}`);
  assert(Boolean(indomieData.ingredients && indomieData.ingredients.length > 20), 'Indomie ingredients must be loaded');
  assert(typeof indomieData.price === 'number' && indomieData.price > 0, 'Indomie must have an automatic IDR price');
  assert(Boolean(indomieData.price_metadata?.price_range?.includes('Rp')), 'Indomie price_range must be formatted in IDR (Rp)');

  // 2D. Factory Packaging Ingredients & Nutrition Facts verification: Barilla Spaghetti
  assert(Boolean(barillaData.factory_ingredients_statement && barillaData.factory_ingredients_statement.startsWith('INGREDIENTS:')), 'Barilla must have factory_ingredients_statement starting with INGREDIENTS:');
  assert(Boolean(barillaData.contains_statement && barillaData.contains_statement.includes('WHEAT')), 'Barilla contains_statement must state CONTAINS: WHEAT.');
  assert(Array.isArray(barillaData.factory_ingredients_breakdown) && barillaData.factory_ingredients_breakdown.length > 0, 'Barilla must have factory_ingredients_breakdown array');
  assert(barillaData.daily_values && typeof barillaData.daily_values.protein === 'number', 'Barilla must have calculated daily_values');
  console.log('  [PASS] Barilla factory packaging ingredients and Nutrition Facts breakdown verified.');

  // 2E. Boycott FLAGGED regression check: Oreo (7622210100917)
  const oreoRes = await fetch(`${baseUrl}/api/analyze-product-barcode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      barcode: '7622210100917',
      userId: 'anon',
      language: 'en'
    })
  });
  const oreoData = await oreoRes.json();
  console.log('  [Oreo 7622210100917 Boycott Gate Check]:', {
    status: oreoData.status,
    brand: oreoData.brand,
    parentCompany: oreoData.boycott?.parentCompany
  });
  assert(oreoData.status === 'FLAGGED', 'Oreo must remain FLAGGED by parent-first boycott gate');
  assert(oreoData.boycott?.parentCompany?.includes('Mondelēz'), 'Oreo parentCompany must highlight Mondelēz International');

  console.log('\n✅ ALL SCANNER PRODUCT FACTS, SAFETY, COLORING, AND PRICING CHECKS PASSED!');
}

runVerification().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
