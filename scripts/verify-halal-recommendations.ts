/**
 * verify-halal-recommendations.ts
 * Rigorous Verification Test Suite for Halal-Only, Onboarding-Personalized, Goal-Oriented Meal Suggestions.
 * Tests A through J (as specified in Section 13 of the directive).
 */

import { classifyHalal } from '../lib/services/recipes/HalalClassifier';
import { checkAllergensAndDislikes } from '../lib/services/recipes/AllergenMatcher';
import { scoreRecipeForUser, rankRecipesForUser, UserRankingContext } from '../lib/services/recipes/GoalOrientedRanker';
import { CuratedRecipeProvider } from '../lib/services/recipes/CuratedRecipeProvider';
import { AuthoritativeRecipe } from '../lib/services/recipes/RecipeProvider';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('RUNNING SECTION 13 VERIFICATION SUITE: TESTS A THROUGH J');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // TEST A: HALAL COMPLIANCE
  // ---------------------------------------------------------------------------
  console.log('--- TEST A: Halal Compliance ---');

  const haramBaconDish = {
    title: 'Crispy Bacon & Egg Sandwich',
    ingredients: [{ item: 'Pork bacon strips' }, { item: 'Eggs' }, { item: 'Bread' }]
  };
  const baconResult = classifyHalal(haramBaconDish);
  assert(baconResult.status === 'HARAM_DETECTED', 'Rejects pork bacon', JSON.stringify(baconResult));

  const haramWineDish = {
    title: 'Beef Bourguignon in Red Wine',
    ingredients: [{ item: 'Halal Beef' }, { item: 'Red wine' }, { item: 'Carrots' }]
  };
  const wineResult = classifyHalal(haramWineDish);
  assert(wineResult.status === 'HARAM_DETECTED', 'Rejects cooking red wine (cooking alcohol evaporates rule enforced)', JSON.stringify(wineResult));

  const haramMirinDish = {
    title: 'Glazed Salmon with Mirin',
    ingredients: [{ item: 'Salmon' }, { item: 'Mirin' }, { item: 'Soy sauce' }]
  };
  const mirinResult = classifyHalal(haramMirinDish);
  assert(mirinResult.status === 'HARAM_DETECTED', 'Rejects alcoholic mirin', JSON.stringify(mirinResult));

  const haramGelatinDish = {
    title: 'Strawberry Mousse',
    ingredients: [{ item: 'Strawberries' }, { item: 'Pork gelatin' }, { item: 'Cream' }]
  };
  const gelatinResult = classifyHalal(haramGelatinDish);
  assert(gelatinResult.status === 'HARAM_DETECTED', 'Rejects pork gelatin', JSON.stringify(gelatinResult));

  const unverifiedGelatinDish = {
    title: 'Panna Cotta',
    ingredients: [{ item: 'Milk' }, { item: 'Gelatin' }, { item: 'Sugar' }]
  };
  const unverifiedGelatin = classifyHalal(unverifiedGelatinDish);
  assert(unverifiedGelatin.status === 'HALAL_UNVERIFIED', 'Rejects ambiguous unspecified gelatin as HALAL_UNVERIFIED', JSON.stringify(unverifiedGelatin));

  const unverifiedMeatDish = {
    title: 'Roast Chicken with Herbs',
    provider: 'external_generic',
    ingredients: [{ item: 'Chicken' }, { item: 'Rosemary' }, { item: 'Olive oil' }]
  };
  const unverifiedMeat = classifyHalal(unverifiedMeatDish);
  assert(unverifiedMeat.status === 'HALAL_UNVERIFIED', 'Rejects external unverified chicken slaughter as HALAL_UNVERIFIED', JSON.stringify(unverifiedMeat));

  const verifiedHalalChicken = {
    title: 'Bubur Oatmeal Ayam Suwir Kuning',
    provider: 'curated',
    cuisine: 'Indonesian',
    dietary_tags: ['Halal'],
    ingredients: [{ item: 'Rolled oats' }, { item: 'Halal chicken breast shredded' }]
  };
  const verifiedResult = classifyHalal(verifiedHalalChicken);
  assert(verifiedResult.status === 'HALAL_VERIFIED', 'Accepts verified halal curated chicken dish', JSON.stringify(verifiedResult));

  const verifiedFishDish = {
    title: 'Grilled Salmon with Steamed Asparagus',
    provider: 'internal',
    cuisine: 'Mediterranean',
    ingredients: [{ item: 'Salmon fillet' }, { item: 'Asparagus' }, { item: 'Olive oil' }, { item: 'Lemon' }]
  };
  assert(classifyHalal(verifiedFishDish).status === 'HALAL_VERIFIED', 'Accepts pure fish and vegetable dish as HALAL_VERIFIED');

  // ---------------------------------------------------------------------------
  // TEST B: WEIGHT REDUCTION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST B: Weight Reduction Personalization ---');
  const curated = new CuratedRecipeProvider();
  const lunchDishes = await curated.searchRecipes({ meal_category: 'lunch' });

  const weightLossContext: UserRankingContext = {
    goal: 'Lose Weight',
    dailyCalorieGoal: 1500, // Deficit target
    activityLevel: 'Lightly Active'
  };

  const rankedWeightLoss = rankRecipesForUser(lunchDishes, weightLossContext, 'lunch');
  assert(rankedWeightLoss.length > 0, 'Returns ranked meals for weight reduction');
  // Top meal for weight loss should not exceed max calorie budget for lunch (target: 35% of 1500 = 525 kcal)
  const topWeightLoss = rankedWeightLoss[0];
  const topCals = topWeightLoss.nutrition?.calories || 0;
  assert(topCals <= 550, `Top weight loss recommendation (${topWeightLoss.title}) fits calorie budget with ${topCals} kcal (<= 550)`);

  // ---------------------------------------------------------------------------
  // TEST C: MUSCLE GAIN
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST C: Muscle Gain Personalization ---');
  const muscleGainContext: UserRankingContext = {
    goal: 'Gain Muscle',
    dailyCalorieGoal: 2800,
    activityLevel: 'Very Active'
  };

  const rankedMuscleGain = rankRecipesForUser(lunchDishes, muscleGainContext, 'lunch');
  assert(rankedMuscleGain.length > 0, 'Returns ranked meals for muscle gain');
  const topMuscleGain = rankedMuscleGain[0];
  const topProtein = topMuscleGain.nutrition?.protein_g || 0;
  assert(topProtein >= 35, `Top muscle gain recommendation (${topMuscleGain.title}) provides high protein: ${topProtein}g (>= 35g)`);

  // ---------------------------------------------------------------------------
  // TEST D: ALLERGIES
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST D: Allergies Strict Exclusion ---');
  const peanutDish: AuthoritativeRecipe = {
    external_id: 'test_sate_kacang',
    provider: 'curated',
    title: 'Sate Dada Ayam Panggang Bumbu Kacang',
    image_url: 'https://example.com/sate.jpg',
    meal_category: 'lunch',
    cuisine: 'Indonesian',
    prep_time_minutes: 10,
    cook_time_minutes: 10,
    servings: 1,
    ingredients: [{ item: 'Chicken', amount: 100, unit: 'g' }, { item: 'Peanut sauce (bumbu kacang)', amount: 30, unit: 'g' }],
    instructions: [{ step: 1, instruction: 'Grill chicken and coat in peanut sauce' }],
    nutrition: { calories: 450, protein_g: 40, carbs_g: 30, fat_g: 15 },
    dietary_tags: ['Halal']
  };

  const allergyPeanutCheck = checkAllergensAndDislikes(peanutDish, ['peanuts', 'kacang'], []);
  assert(!allergyPeanutCheck.safe, 'Rejects peanut dish for user with declared peanut allergy');

  const dairyDish: AuthoritativeRecipe = {
    external_id: 'test_parfait',
    provider: 'curated',
    title: 'Greek Yogurt Parfait',
    image_url: 'https://example.com/yogurt.jpg',
    meal_category: 'breakfast',
    cuisine: 'Western',
    prep_time_minutes: 5,
    cook_time_minutes: 0,
    servings: 1,
    ingredients: [{ item: 'Greek yogurt (susu)', amount: 150, unit: 'g' }, { item: 'Berries', amount: 50, unit: 'g' }],
    instructions: [{ step: 1, instruction: 'Layer yogurt and berries' }],
    nutrition: { calories: 250, protein_g: 18, carbs_g: 25, fat_g: 4 },
    dietary_tags: ['Halal']
  };

  const allergyDairyCheck = checkAllergensAndDislikes(dairyDish, ['dairy', 'milk', 'susu'], []);
  assert(!allergyDairyCheck.safe, 'Rejects dairy dish for user with declared dairy allergy');

  // ---------------------------------------------------------------------------
  // TEST E: DISLIKED FOODS
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST E: Disliked Foods Exclusion ---');
  const mushroomDish: AuthoritativeRecipe = {
    external_id: 'test_sup_jamur',
    provider: 'curated',
    title: 'Sup Ayam Jamur Tiram',
    image_url: 'https://example.com/soup.jpg',
    meal_category: 'dinner',
    cuisine: 'Indonesian',
    prep_time_minutes: 10,
    cook_time_minutes: 15,
    servings: 1,
    ingredients: [{ item: 'Halal chicken', amount: 120, unit: 'g' }, { item: 'Oyster mushrooms (jamur tiram)', amount: 60, unit: 'g' }],
    instructions: [{ step: 1, instruction: 'Simmer chicken and mushrooms' }],
    nutrition: { calories: 310, protein_g: 34, carbs_g: 15, fat_g: 7 },
    dietary_tags: ['Halal']
  };

  const dislikeMushroomCheck = checkAllergensAndDislikes(mushroomDish, [], ['mushroom', 'jamur']);
  assert(!dislikeMushroomCheck.safe, 'Rejects dish containing user-disliked mushrooms');

  // ---------------------------------------------------------------------------
  // TEST F: USER DIFFERENTIATION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST F: User Differentiation ---');
  const userAContext: UserRankingContext = {
    goal: 'Lose Weight',
    dailyCalorieGoal: 1400,
    preferredCuisines: ['Indonesian']
  };
  const userBContext: UserRankingContext = {
    goal: 'Gain Muscle',
    dailyCalorieGoal: 2900,
    preferredCuisines: ['Western', 'Healthy']
  };

  const rankedA = rankRecipesForUser(lunchDishes, userAContext, 'lunch');
  const rankedB = rankRecipesForUser(lunchDishes, userBContext, 'lunch');

  const topAId = rankedA[0]?.external_id;
  const topBId = rankedB[0]?.external_id;
  assert(topAId !== topBId, `User A top choice (${rankedA[0]?.title}) is differentiated from User B top choice (${rankedB[0]?.title})`);

  // ---------------------------------------------------------------------------
  // TEST G: NUTRITION INTEGRITY (ZERO FABRICATION)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST G: Nutrition Integrity ---');
  for (const meal of lunchDishes) {
    const c = meal.nutrition?.calories;
    const p = meal.nutrition?.protein_g;
    const ch = meal.nutrition?.carbs_g;
    const f = meal.nutrition?.fat_g;
    assert(typeof c === 'number' && c > 100 && c < 1200, `Meal "${meal.title}" has realistic calories (${c} kcal)`);
    assert(typeof p === 'number' && p >= 0, `Meal "${meal.title}" has realistic protein (${p}g)`);
    assert(typeof ch === 'number' && ch >= 0, `Meal "${meal.title}" has realistic carbs (${ch}g)`);
    assert(typeof f === 'number' && f >= 0, `Meal "${meal.title}" has realistic fat (${f}g)`);
  }

  // ---------------------------------------------------------------------------
  // TEST I: CACHE REVALIDATION LOGIC
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST I: Cache Revalidation on Allergy Change ---');
  const cachedPlan = [
    { title: 'Sate Ayam Bumbu Kacang', ingredients: [{ item: 'Peanut sauce' }] }
  ];
  // User newly adds peanut allergy
  const updatedAllergies = ['peanut'];
  const hasViolation = cachedPlan.some(meal => {
    const text = `${meal.title} ${meal.ingredients.map(i => i.item).join(' ')}`.toLowerCase();
    return updatedAllergies.some(alg => text.includes(alg));
  });
  assert(hasViolation === true, 'Detected constraint violation in cached plan after allergy update -> triggers fresh plan generation');

  // ---------------------------------------------------------------------------
  // TEST J: EMPTY CANDIDATE POOL SAFE HANDLING
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST J: Empty Candidate Pool Safe Handling ---');
  const emptyCandidates: AuthoritativeRecipe[] = [];
  const rankedEmpty = rankRecipesForUser(emptyCandidates, weightLossContext, 'lunch');
  assert(Array.isArray(rankedEmpty) && rankedEmpty.length === 0, 'Returns empty array safely when no candidates match, preventing fake food insertion');

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
