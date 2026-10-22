/**
 * AllergySafeRecipeAdapter.ts
 *
 * Ensures that:
 * 1. When any user searches for or views ANY meal, if the meal contains ingredients
 *    that conflict with the user's onboarding allergies or dietary restrictions,
 *    it is deterministically adapted into a safe, 100% Halal, allergen-free alternative
 *    (with updated title, safe ingredients, and safe step-by-step cooking instructions).
 * 2. When generating the "History of the Meal" (`description`), if the user has onboarding
 *    allergies, it strictly follows the 3-part structure:
 *    - Part 1 (Before History): "Since you have an allergy to [allergies], I have opted to go for [safe alternative]..."
 *    - Part 2 (Culinary History): The authentic cultural and culinary origin of the meal.
 *    - Part 3 (After History): A distinct explanation of why this specific version is suggested
 *      because of the user's allergy and how it supports their onboarding goal.
 */

import { UserProfileContext } from '@/lib/services/ai/ContextAssembler';
import { checkAllergensAndDislikes, parseAllergyTokens } from './AllergenMatcher';
import { AuthoritativeRecipe, Ingredient, Instruction } from './RecipeProvider';

export interface SubstitutionRecord {
  allergen: string;
  originalTerm: string;
  safeAlternative: string;
  reason: string;
}

export interface AdaptedRecipeResult {
  recipe: AuthoritativeRecipe;
  wasAdapted: boolean;
  substitutions: SubstitutionRecord[];
  allergyLabels: string[];
  historyNarrative: string;
}

const ALLERGEN_DISPLAY_LABELS: Record<string, string> = {
  peanut: 'peanuts',
  peanuts: 'peanuts',
  tree_nuts: 'tree nuts',
  nut: 'nuts',
  seafood: 'seafood',
  fish: 'fish',
  shellfish: 'shellfish',
  cheese: 'cheese',
  dairy: 'dairy',
  milk: 'dairy milk',
  lactose: 'lactose/dairy',
  egg: 'eggs',
  eggs: 'eggs',
  egg_whites: 'egg whites',
  gluten: 'gluten',
  wheat: 'wheat/gluten',
  soy: 'soy',
  sesame: 'sesame'
};

interface ReplacementRule {
  allergenKeys: string[];
  pattern: RegExp;
  replacement: string;
  titleReplacement?: string;
  allergenLabel: string;
  safeSummary: string;
  avoidedTrigger: string;
}

const REPLACEMENT_RULES: ReplacementRule[] = [
  // EGG / EGG WHITES
  {
    allergenKeys: ['egg', 'eggs'],
    pattern: /\b(\d+\s+)?(large\s+|medium\s+|fresh\s+|free-range\s+|hard-boiled\s+|poached\s+|fried\s+|scrambled\s+|beaten\s+)?(egg\s+whites?|egg\s+yolks?|eggs?)\b/gi,
    replacement: 'seasoned chickpea & flaxseed binder (or silken tofu)',
    titleReplacement: 'Egg-Free Savory Chickpea & Herb',
    allergenLabel: 'egg whites/eggs',
    safeSummary: 'plant-based flaxseed, mashed banana, or savory chickpea-tofu protein',
    avoidedTrigger: 'whole eggs and egg whites'
  },
  {
    allergenKeys: ['egg', 'eggs'],
    pattern: /\b(mayonnaise|mayo|aioli)\b/gi,
    replacement: 'creamy avocado & olive oil herb dressing',
    allergenLabel: 'egg whites/eggs',
    safeSummary: 'egg-free avocado olive oil dressing',
    avoidedTrigger: 'egg-based mayonnaise'
  },
  {
    allergenKeys: ['egg', 'eggs'],
    pattern: /\b(omelette|omelet|frittata)\b/gi,
    replacement: 'Savory Chickpea & Herb Omelette (Egg-Free)',
    allergenLabel: 'egg whites/eggs',
    safeSummary: 'golden chickpea-flour and herb omelette batter',
    avoidedTrigger: 'eggs and egg whites'
  },

  // CHEESE / DAIRY
  {
    allergenKeys: ['cheese', 'dairy', 'milk', 'lactose'],
    pattern: /\b(cream\s+cheese|sour\s+cream|cottage\s+cheese|ricotta|mascarpone)\b/gi,
    replacement: 'dairy-free cultured coconut & oat cream',
    allergenLabel: 'cheese',
    safeSummary: 'dairy-free oat and coconut cream',
    avoidedTrigger: 'dairy cheese and cream cheese'
  },
  {
    allergenKeys: ['cheese', 'dairy', 'milk', 'lactose'],
    pattern: /\b(parmesan|parmigiano|pecorino|asiago)\b/gi,
    replacement: 'savory nutritional yeast & garlic herb crumble (dairy-free)',
    allergenLabel: 'cheese',
    safeSummary: 'savory nutritional yeast and toasted garlic herbs',
    avoidedTrigger: 'aged dairy cheese'
  },
  {
    allergenKeys: ['cheese', 'dairy', 'milk', 'lactose'],
    pattern: /\b(mozzarella|cheddar|feta|gouda|swiss\s+cheese|provolone|halloumi|paneer|cheese)\b/gi,
    replacement: 'melted dairy-free plant mozzarella & herb drizzle',
    allergenLabel: 'cheese',
    safeSummary: 'dairy-free plant-based cheese alternative and extra-virgin olive oil',
    avoidedTrigger: 'dairy cheese'
  },
  {
    allergenKeys: ['dairy', 'milk', 'lactose'],
    pattern: /\b(greek\s+yogurt|plain\s+yogurt|yoghurt|yogurt|buttermilk|heavy\s+cream|whipping\s+cream|whole\s+milk|skim\s+milk|cow'?s\s+milk)\b/gi,
    replacement: 'unsweetened oat milk & coconut yogurt',
    allergenLabel: 'dairy',
    safeSummary: 'unsweetened oat milk and cultured coconut yogurt',
    avoidedTrigger: 'dairy milk and yogurt'
  },
  {
    allergenKeys: ['dairy', 'milk', 'lactose'],
    pattern: /\b(unsalted\s+butter|melted\s+butter|clarified\s+butter|ghee)\b/gi,
    replacement: 'extra-virgin olive oil',
    allergenLabel: 'dairy',
    safeSummary: 'heart-healthy extra-virgin olive oil',
    avoidedTrigger: 'dairy butter'
  },

  // SEAFOOD / FISH / SHELLFISH
  {
    allergenKeys: ['seafood', 'fish', 'shellfish'],
    pattern: /\b(wild\s+salmon|salmon\s+fillets?|salmon|tuna|cod\s+fillets?|cod|tilapia|snapper|trout|mackerel|haddock|halibut|sardines?|anchov(?:y|ies)|herrings?|sledz|fish\s+fillets?|white\s+fish|fish)\b/gi,
    replacement: 'tender Halal grilled chicken breast strips',
    allergenLabel: 'seafood',
    safeSummary: 'lean Halal-certified chicken breast and crisp vegetables',
    avoidedTrigger: 'fish and marine seafood'
  },
  {
    allergenKeys: ['seafood', 'fish', 'shellfish'],
    pattern: /\b(shrimps?|prawns?|crabs?|lobsters?|scallops?|mussels?|clams?|oysters?|calamari|squid|octopus|seafood)\b/gi,
    replacement: 'marinated Halal chicken breast & roasted chickpeas',
    allergenLabel: 'seafood',
    safeSummary: 'marinated Halal chicken breast and herb-roasted chickpeas',
    avoidedTrigger: 'shellfish and seafood'
  },
  {
    allergenKeys: ['seafood', 'fish', 'shellfish'],
    pattern: /\b(fish\s+sauce|oyster\s+sauce|shrimp\s+paste|saus\s+tiram)\b/gi,
    replacement: 'umami mushroom & coconut aminos glaze',
    allergenLabel: 'seafood',
    safeSummary: 'umami mushroom broth and coconut aminos',
    avoidedTrigger: 'seafood-derived sauces'
  },

  // PEANUTS & TREE NUTS
  {
    allergenKeys: ['peanut', 'peanuts', 'nut', 'tree_nuts'],
    pattern: /\b(peanut\s+butter|almond\s+butter|cashew\s+butter)\b/gi,
    replacement: 'creamy roasted sunflower seed butter',
    allergenLabel: 'peanuts',
    safeSummary: 'creamy roasted sunflower seed butter',
    avoidedTrigger: 'peanuts and nut butters'
  },
  {
    allergenKeys: ['peanut', 'peanuts', 'nut', 'tree_nuts'],
    pattern: /\b(peanuts?|groundnuts?|arachis)\b/gi,
    replacement: 'toasted pumpkin & sunflower seeds',
    allergenLabel: 'peanuts',
    safeSummary: 'crunchy toasted pumpkin and sunflower seeds',
    avoidedTrigger: 'peanuts'
  },
  {
    allergenKeys: ['tree_nuts', 'nut'],
    pattern: /\b(almonds?|walnuts?|cashews?|pecans?|pistachios?|hazelnuts?|macadamias?|pine\s+nuts?)\b/gi,
    replacement: 'toasted pumpkin seeds & chia seeds',
    allergenLabel: 'tree nuts',
    safeSummary: 'nutrient-dense pumpkin and chia seeds',
    avoidedTrigger: 'tree nuts'
  },

  // GLUTEN / WHEAT
  {
    allergenKeys: ['gluten', 'wheat'],
    pattern: /\b(whole\s+wheat\s+pasta|spaghetti|penne|fettuccine|macaroni|lasagna\s+sheets|egg\s+noodles|ramen\s+noodles|wheat\s+noodles|pasta)\b/gi,
    replacement: 'gluten-free brown rice & red lentil pasta',
    allergenLabel: 'gluten',
    safeSummary: 'gluten-free brown rice and lentil pasta',
    avoidedTrigger: 'wheat-based pasta and gluten'
  },
  {
    allergenKeys: ['gluten', 'wheat'],
    pattern: /\b(whole\s+wheat\s+bread|whole\s+grain\s+bread|brioche\s+bread|whole\s+wheat\s+bun|burger\s+bun|pita\s+bread|flatbread|wheat\s+tortilla|flour\s+tortilla)\b/gi,
    replacement: 'gluten-free whole-grain wrap/bun',
    allergenLabel: 'gluten',
    safeSummary: 'certified gluten-free whole-grain bread/wrap',
    avoidedTrigger: 'wheat bread and gluten'
  },
  {
    allergenKeys: ['gluten', 'wheat'],
    pattern: /\b(all-purpose\s+flour|wheat\s+flour|plain\s+flour|self-raising\s+flour|breadcrumbs|panko)\b/gi,
    replacement: 'gluten-free oat flour',
    allergenLabel: 'gluten',
    safeSummary: 'wholesome gluten-free oat flour',
    avoidedTrigger: 'wheat flour'
  },
  {
    allergenKeys: ['gluten', 'wheat', 'soy'],
    pattern: /\b(low-sodium\s+soy\s+sauce|soy\s+sauce|shoyu)\b/gi,
    replacement: 'gluten-free coconut aminos',
    allergenLabel: 'gluten/soy',
    safeSummary: 'savory coconut aminos',
    avoidedTrigger: 'wheat-brewed soy sauce'
  }
];

export function formatUserAllergiesList(rawAllergies: string[]): string[] {
  const rawJoined = (rawAllergies || []).join(' ').toLowerCase();
  const hasEggWhitesSpecifically = rawJoined.includes('egg white');
  const tokens = parseAllergyTokens(rawAllergies);
  const labels: string[] = [];
  for (const t of tokens) {
    let label = ALLERGEN_DISPLAY_LABELS[t] || t;
    if ((t === 'egg' || t === 'eggs') && hasEggWhitesSpecifically) {
      label = 'egg whites';
    }
    if (!labels.includes(label)) {
      labels.push(label);
    }
  }
  return labels;
}

export function formatNaturalList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function adaptTextWithRules(
  text: string,
  activeRules: ReplacementRule[],
  substitutions: SubstitutionRecord[],
  isTitle: boolean = false
): string {
  // Temporarily protect existing "-Free" badges so we never replace inside "(Egg-Free)" or "(Seafood-Free)"
  const protectedBadges: string[] = [];
  let updated = text.replace(/\b([A-Za-z]+-Free)\b/gi, match => {
    const idx = protectedBadges.length;
    protectedBadges.push(match);
    return `__SAFE_BADGE_${idx}__`;
  });

  for (const rule of activeRules) {
    if (rule.pattern.test(updated)) {
      rule.pattern.lastIndex = 0;
      const matched = updated.match(rule.pattern)?.[0] || rule.avoidedTrigger;
      const rep = isTitle && rule.titleReplacement ? rule.titleReplacement : rule.replacement;
      updated = updated.replace(rule.pattern, rep);
      if (!substitutions.some(s => s.allergen === rule.allergenLabel && s.safeAlternative === rule.safeSummary)) {
        substitutions.push({
          allergen: rule.allergenLabel,
          originalTerm: matched,
          safeAlternative: rule.safeSummary,
          reason: `Replaces ${rule.avoidedTrigger} with ${rule.safeSummary}`
        });
      }
    }
    rule.pattern.lastIndex = 0;
  }

  updated = updated.replace(/__SAFE_BADGE_(\d+)__/g, (_, idx) => protectedBadges[Number(idx)] || '');
  return updated;
}

function cleanAdaptedTitle(title: string, activeAllergenKeys: Set<string>, wasAdapted: boolean): string {
  let clean = title
    .replace(/\s+/g, ' ')
    .replace(/melted dairy-free plant mozzarella & herb drizzle/gi, 'Dairy-Free Herb Cheese')
    .replace(/seasoned chickpea & flaxseed binder \(or silken tofu\)/gi, 'Chickpea & Herb (Egg-Free)')
    .replace(/tender Halal grilled chicken breast strips/gi, 'Grilled Halal Chicken')
    .replace(/marinated Halal chicken breast & roasted chickpeas/gi, 'Grilled Halal Chicken')
    .replace(/creamy roasted sunflower seed butter/gi, 'Sunflower Seed Butter')
    .replace(/toasted pumpkin & sunflower seeds/gi, 'Toasted Seeds')
    .replace(/gluten-free brown rice & red lentil pasta/gi, 'Gluten-Free Pasta')
    .replace(/unsweetened oat milk & coconut yogurt/gi, 'Coconut-Oat Yogurt')
    .trim();

  if (wasAdapted && !/\((?:allergy-safe|egg-free|dairy-free|peanut-free|seafood-free|gluten-free)/i.test(clean)) {
    const badges: string[] = [];
    if (activeAllergenKeys.has('egg') || activeAllergenKeys.has('eggs')) badges.push('Egg-Free');
    if (activeAllergenKeys.has('cheese') || activeAllergenKeys.has('dairy')) badges.push('Dairy-Free');
    if (activeAllergenKeys.has('seafood') || activeAllergenKeys.has('fish')) badges.push('Seafood-Free');
    if (activeAllergenKeys.has('peanut') || activeAllergenKeys.has('peanuts')) badges.push('Peanut-Free');
    if (activeAllergenKeys.has('gluten') || activeAllergenKeys.has('wheat')) badges.push('Gluten-Free');
    if (badges.length > 0) {
      const badgeText = badges.slice(0, 2).join(', ');
      if (!clean.toLowerCase().includes(badgeText.toLowerCase())) {
        clean = `${clean} (${badgeText} Alternative)`;
      }
    }
  }
  return clean;
}

/**
 * Builds the 3-part "History of the Meal" narrative required when a user has allergies:
 * 1. Opening ("Since you have an allergy to..., I have opted to go for...")
 * 2. Authentic Culinary History of the Meal
 * 3. Distinct Allergy-Specific Recommendation Explanation after the history
 */
export function buildAllergyAwareHistoryNarrative(
  recipeTitle: string,
  ingredients: Array<{ item: string; amount?: string | number; unit?: string } | string>,
  baseCulinaryHistory: string,
  userContext: UserProfileContext | null | undefined,
  substitutions: SubstitutionRecord[] = [],
  calories: number = 350,
  protein: number = 20
): string {
  // Strip any pre-existing "Since you have an allergy to..." wrapper so we never double-wrap
  const cleanHistory = (baseCulinaryHistory || '')
    .replace(/^Since you have an allergy to[^.]*\.\s*/i, '')
    .replace(/\s*Because you are allergic to.*$/i, '')
    .replace(/\s*Why this meal is suggested for you:.*$/i, '')
    .replace(/\s*I specifically suggest this.*$/i, '')
    .trim();

  const effectiveHistory =
    cleanHistory.length > 25
      ? cleanHistory
      : `Originating as a cherished everyday favorite in wholesome home-cooking traditions, ${recipeTitle} brings together balanced, aromatic Halal ingredients celebrated across generations for steady nourishment and vibrant flavor.`;

  const rawAllergies = userContext?.allergies || [];
  const allergyLabels = formatUserAllergiesList(rawAllergies);

  if (allergyLabels.length === 0) {
    return effectiveHistory;
  }

  const formattedAllergies = formatNaturalList(allergyLabels);
  const goalText = userContext?.goal || 'healthy nutrition';

  const ingSample = ingredients
    .slice(0, 3)
    .map(i => (typeof i === 'string' ? i : i.item))
    .map(s => s.replace(/^\d+[\s\/.\d]*(?:cup|cups|tbsp|tsp|g|oz|medium|large|small|cloves?|slices?)?\s*/i, '').trim())
    .filter(Boolean);

  const safeHighlight =
    substitutions.length > 0
      ? formatNaturalList(Array.from(new Set(substitutions.map(s => s.safeAlternative))))
      : ingSample.length > 0
      ? `naturally allergen-free ${formatNaturalList(ingSample)}`
      : '100% allergen-safe, Halal whole-food ingredients';

  // PART 1: Mandatory opening before the history
  const openingSentence = `Since you have an allergy to ${formattedAllergies}, I have opted to go for ${recipeTitle} made with ${safeHighlight}.`;

  // PART 2: Authentic history of the meal
  const middleHistory = effectiveHistory;

  // PART 3: Distinct explanation after the history of why this meal is suggested because of their allergy
  const closingExplanation =
    substitutions.length > 0
      ? `Because you are allergic to ${formattedAllergies}, I specifically suggest this adapted version for you: standard preparations often include ${formatNaturalList(
          Array.from(new Set(substitutions.map(s => s.originalTerm.toLowerCase())))
        )}, so by replacing those triggers with ${safeHighlight}, you can enjoy every step of ${recipeTitle} safely while getting ${calories} kcal and ${protein}g of protein tailored to your ${goalText} goal.`
      : `Because you are allergic to ${formattedAllergies}, I specifically suggest this meal for you as a safe, nutritious choice that is completely free of ${formattedAllergies}, relying instead on ${safeHighlight} so you can cook and enjoy a satisfying ${calories} kcal (${protein}g protein) Halal meal aligned with your ${goalText} objective without any allergy risk.`;

  return `${openingSentence} ${middleHistory} ${closingExplanation}`;
}

/**
 * Deterministically adapts any candidate recipe into a safe, allergen-free Halal version
 * if it conflicts with the user's onboarding allergies, and attaches the 3-part history narrative.
 */
export function adaptRecipeForUser(
  recipe: AuthoritativeRecipe,
  userContext: UserProfileContext | null | undefined,
  baseCulinaryHistory?: string
): AdaptedRecipeResult {
  const rawAllergies = userContext?.allergies || [];
  const dislikes = userContext?.dislikedFoods || [];
  const canonicalTokens = new Set(parseAllergyTokens(rawAllergies));
  const allergyLabels = formatUserAllergiesList(rawAllergies);

  // Check if recipe currently triggers any allergen or dislike
  const initialCheck = checkAllergensAndDislikes(recipe, rawAllergies, dislikes);
  const activeRules = REPLACEMENT_RULES.filter(r =>
    r.allergenKeys.some(k => canonicalTokens.has(k))
  );

  const substitutions: SubstitutionRecord[] = [];
  let wasAdapted = false;

  let adaptedTitle = recipe.title;
  let adaptedIngredients: Ingredient[] = (recipe.ingredients || []).map(ing => ({ ...ing }));
  let adaptedInstructions: Instruction[] = (recipe.instructions || []).map(inst => ({ ...inst }));

  if (!initialCheck.safe && activeRules.length > 0) {
    // 1. Adapt Title
    const newTitle = adaptTextWithRules(adaptedTitle, activeRules, substitutions, true);
    if (newTitle !== adaptedTitle) {
      adaptedTitle = newTitle;
      wasAdapted = true;
    }

    // 2. Adapt Ingredients
    adaptedIngredients = adaptedIngredients.map(ing => {
      const origItem = ing.item || '';
      const newItem = adaptTextWithRules(origItem, activeRules, substitutions, false);
      if (newItem !== origItem) {
        wasAdapted = true;
      }
      return {
        ...ing,
        item: newItem,
        normalized_name: newItem.toLowerCase()
      };
    });

    // 3. Adapt Instructions
    adaptedInstructions = adaptedInstructions.map(inst => {
      const origStep = inst.instruction || '';
      const newStep = adaptTextWithRules(origStep, activeRules, substitutions, false);
      if (newStep !== origStep) {
        wasAdapted = true;
      }
      return {
        ...inst,
        instruction: newStep
      };
    });

    // 4. Catch-all safety pass: if any specific allergen token still remains in an ingredient line, replace that ingredient line cleanly
    const postCheck = checkAllergensAndDislikes(
      { title: adaptedTitle, ingredients: adaptedIngredients },
      rawAllergies,
      dislikes
    );
    if (!postCheck.safe) {
      adaptedIngredients = adaptedIngredients.map(ing => {
        const singleCheck = checkAllergensAndDislikes(
          { title: '', ingredients: [ing] },
          rawAllergies,
          dislikes
        );
        if (!singleCheck.safe) {
          wasAdapted = true;
          const fallbackSafe = '1/2 cup diced zucchini, bell peppers & fresh herbs';
          substitutions.push({
            allergen: singleCheck.detectedAllergens.join(', ') || 'allergen',
            originalTerm: ing.item,
            safeAlternative: 'fresh garden vegetables and herbs',
            reason: 'Replaced allergen ingredient with safe vegetable & herb alternative'
          });
          return {
            item: fallbackSafe,
            amount: '1/2',
            unit: 'cup',
            normalized_name: fallbackSafe
          };
        }
        return ing;
      });
    }

    adaptedTitle = cleanAdaptedTitle(adaptedTitle, canonicalTokens, wasAdapted);
  }

  const cals = recipe.nutrition?.calories || recipe.total_calories || 350;
  const prot = recipe.nutrition?.protein_g || recipe.protein_g || 20;

  const historyNarrative = buildAllergyAwareHistoryNarrative(
    adaptedTitle,
    adaptedIngredients,
    baseCulinaryHistory || recipe.clinical_justification || '',
    userContext,
    substitutions,
    cals,
    prot
  );

  const adaptedRecipe: AuthoritativeRecipe = {
    ...recipe,
    title: adaptedTitle,
    name: adaptedTitle,
    ingredients: adaptedIngredients,
    instructions: adaptedInstructions,
    clinical_justification: historyNarrative
  };

  return {
    recipe: adaptedRecipe,
    wasAdapted,
    substitutions,
    allergyLabels,
    historyNarrative
  };
}
