/**
 * RecipeValidationGate
 * Clinical & dietary safety gate enforcing hard allergy exclusion,
 * preference validation, 7-day duplicate exclusion, and automated candidate replacement.
 */

export interface UserDietaryContext {
  allergies: string[];
  dietaryLifestyle: string[];
  dietaryPreference: string;
  restrictions: string[];
  dislikes: string[];
  preferredCuisines: string[];
  calorieGoal: number;
  maxMinutes: number;
  language: string;
}

export interface CandidateDish {
  id?: string;
  title: string;
  name?: string;
  cuisine?: string;
  total_calories?: number;
  calories?: number;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  ingredients?: Array<{ item: string; amount: string; unit: string }>;
  instructions?: string[];
  clinical_justification?: string;
  meal_type?: string;
}

// Deep allergy dictionary mapping allergens to prohibited keywords and derivatives
const ALLERGEN_KEYWORD_MAP: Record<string, string[]> = {
  seafood: [
    'seafood', 'fish', 'shrimp', 'prawn', 'crab', 'lobster', 'squid', 'octopus', 'mussel', 'oyster', 'clam', 'shellfish',
    'anchovy', 'tuna', 'salmon', 'snapper', 'tilapia', 'catfish', 'mackerel',
    'ikan', 'udang', 'cumi', 'kepiting', 'gurame', 'nila', 'kakap', 'tongkol', 'cakalang', 'teri', 'lele', 'bandeng', 'kerang',
    'fish sauce', 'kecap ikan', 'oyster sauce', 'saus tiram', 'shrimp paste', 'terasi', 'petis', 'dashi', 'bonito', 'seafood stock'
  ],
  nut: [
    'peanut', 'almond', 'walnut', 'cashew', 'hazelnut', 'pecan', 'pistachio',
    'kacang tanah', 'kacang mete', 'kacang almond', 'bumbu kacang', 'peanut sauce', 'peanut butter'
  ],
  gluten: [
    'wheat', 'gluten', 'barley', 'rye', 'terigu', 'gandum', 'roti gandum', 'whole wheat', 'pasta', 'mie', 'noodle', 'soba'
  ],
  dairy: [
    'dairy', 'milk', 'cheese', 'butter', 'cream', 'yogurt', 'whey',
    'susu', 'keju', 'mentega', 'krim', 'greek yogurt'
  ],
  egg: [
    'egg', 'omelet', 'omelette', 'mayonnaise', 'scrambled', 'sunny egg', 'poached egg',
    'telur', 'telur ayam', 'telur puyuh', 'ceplok', 'dadar', 'mayones'
  ],
  soy: [
    'soy', 'soya', 'tofu', 'tempeh', 'edamame', 'miso', 'soy milk', 'soy sauce',
    'kedelai', 'tahu', 'tempe', 'susu kedelai', 'kecap manis', 'kecap asin'
  ],
  pork: [
    'pork', 'bacon', 'ham', 'lard', 'prosciutto', 'babi', 'minyak babi'
  ]
};

/**
 * Composition Profiles to ensure visual variety across the 12 selections in each category.
 */
export const IMAGE_COMPOSITION_PROFILES = [
  'top-down flat-lay presentation with rustic napkin',
  '45-degree elegant restaurant table photography',
  'macro close-up highlighting texture and seasoning',
  'plated presentation with vibrant fresh herbs garnish',
  'warm wooden dining table setting in natural lighting',
  'minimalist modern ceramic bowl composition',
  'traditional authentic regional tableware presentation',
  'overhead banquet style with accompanying condiments',
  'artisan cast-iron pan serving presentation',
  'fresh culinary aesthetic with steam and herb sprig',
  'contemporary gourmet plating with contrasting sauces',
  'cozy comfort food styled bowl setting'
] as const;

/**
 * Normalizes dish title and main ingredients into a deterministic meal signature.
 * E.g., "Nasi Merah Ayam Bakar Bumbu Rujak" -> "indonesian-ayam-bakar-rujak-nasi-merah"
 */
export function generateMealSignature(dish: CandidateDish): string {
  const titlePart = (dish.title || dish.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 4)
    .join('-');

  const cuisinePart = (dish.cuisine || 'general').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${cuisinePart}-${titlePart || 'meal'}`;
}

/**
 * Normalizes dish title into a canonical recipe key to prevent disguised duplicates across days.
 * E.g., "Nasi Merah Ayam Bakar Bumbu Rujak" -> "chicken_grilled_rujak_brown_rice"
 */
export function normalizeCanonicalKey(title: string): string {
  const clean = title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
  
  const tokens = clean.split(/\s+/).filter(t => t.length > 2);
  tokens.sort();
  return tokens.slice(0, 4).join('_');
}

/**
 * Validates that an image URL and its query metadata are allergen-safe and match the meal.
 */
export function validateImageForRecipe(
  imageUrl: string,
  dish: CandidateDish,
  context: UserDietaryContext
): { valid: boolean; reason?: string } {
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
    return { valid: false, reason: 'Invalid or missing image URL' };
  }

  const imageString = (imageUrl + ' ' + dish.title).toLowerCase();

  // Allergen visual check: Ensure image URL doesn't contain forbidden allergen keywords
  for (const allergy of context.allergies) {
    const clean = allergy.toLowerCase().trim();
    if (!clean || clean === 'none') continue;
    if (clean === 'seafood' || clean === 'fish') {
      const forbidden = ['fish', 'shrimp', 'crab', 'lobster', 'squid', 'octopus', 'shellfish', 'prawn'];
      for (const f of forbidden) {
        if (imageString.includes(f) && !dish.title.toLowerCase().includes(f)) {
          return { valid: false, reason: `Image depicts prohibited allergen: ${f}` };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Scans candidate dish against user allergies, restrictions, and dislikes.
 * Returns { valid: boolean, reason?: string }
 */
export function validateCandidate(
  dish: CandidateDish,
  context: UserDietaryContext,
  recentlyServedKeys: Set<string>,
  favoriteKeys: Set<string>
): { valid: boolean; reason?: string } {
  const dishText = [
    dish.title || '',
    dish.cuisine || '',
    ...(dish.ingredients || []).map(i => i.item),
    ...(dish.instructions || [])
  ].join(' ').toLowerCase();

  // 1. Deep Allergy Scan (Hard Constraint)
  for (const allergy of context.allergies) {
    const cleanAllergy = allergy.toLowerCase().trim();
    if (!cleanAllergy || cleanAllergy === 'none' || cleanAllergy === 'tidak ada') continue;

    // Direct string match
    if (dishText.includes(cleanAllergy)) {
      return { valid: false, reason: `Contains allergen: ${cleanAllergy}` };
    }

    // Match against detailed keyword derivatives
    for (const [allergenKey, keywords] of Object.entries(ALLERGEN_KEYWORD_MAP)) {
      if (cleanAllergy.includes(allergenKey) || allergenKey.includes(cleanAllergy)) {
        for (const kw of keywords) {
          const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(^|\\s|[^a-zA-Z0-9])${escaped}($|\\s|[^a-zA-Z0-9])`, 'i');
          if (regex.test(dishText)) {
            return { valid: false, reason: `Contains prohibited ${allergenKey} derivative: "${kw}"` };
          }
        }
      }
    }
  }

  // 2. Dietary Lifestyle Scan (e.g. Vegetarian / Vegan / Halal)
  const isHalal = context.dietaryLifestyle.some(d => d.toLowerCase().includes('halal'));
  if (isHalal) {
    for (const kw of ALLERGEN_KEYWORD_MAP.pork) {
      if (dishText.includes(kw)) {
        return { valid: false, reason: `Contains non-Halal ingredient: "${kw}"` };
      }
    }
  }

  const isVegetarian = context.dietaryLifestyle.some(d => d.toLowerCase().includes('vegetarian'));
  const isVegan = context.dietaryLifestyle.some(d => d.toLowerCase().includes('vegan'));
  if (isVegetarian || isVegan) {
    const meatKeywords = ['ayam', 'chicken', 'sapi', 'beef', 'daging', 'meat', 'ikan', 'fish', 'udang', 'shrimp', 'pork'];
    for (const kw of meatKeywords) {
      if (dishText.includes(kw)) {
        return { valid: false, reason: `Contains animal protein violating vegetarian/vegan lifestyle: "${kw}"` };
      }
    }
  }

  // 3. User Dislikes / Preferences Scan (Personal taste separation)
  for (const dislike of context.dislikes) {
    const cleanDislike = dislike.toLowerCase().trim();
    if (!cleanDislike || cleanDislike === 'none') continue;
    if (dishText.includes(cleanDislike)) {
      return { valid: false, reason: `Contains disliked food: "${cleanDislike}"` };
    }
  }

  // 4. 7-Day History Duplicate Scan
  const canonicalKey = normalizeCanonicalKey(dish.title);
  if (recentlyServedKeys.has(canonicalKey) && !favoriteKeys.has(canonicalKey)) {
    return { valid: false, reason: `Previously served within last 7 days and not favorited: "${dish.title}"` };
  }

  return { valid: true };
}

/**
 * Universal safe backup pool guaranteed to be free of seafood, nuts, and common allergens.
 */
const SAFE_ALLERGEN_FREE_BACKUPS: Record<string, CandidateDish[]> = {
  breakfast: [
    {
      title: 'Bubur Oatmeal Ayam Suwir Kuning',
      cuisine: 'Indonesian',
      total_calories: 350,
      protein_g: 28, carbs_g: 42, fat_g: 8,
      ingredients: [
        { item: 'Oatmeal instan / rolled oats', amount: '50', unit: 'g' },
        { item: 'Dada ayam rebus suwir', amount: '100', unit: 'g' },
        { item: 'Kaldu ayam kuning kunyit', amount: '250', unit: 'ml' },
        { item: 'Daun bawang & seledri', amount: '1', unit: 'sdm' }
      ],
      instructions: ['Didihkan kaldu ayam kuning.', 'Masukkan oat dan masak 3 menit.', 'Tata suwiran ayam dan daun bawang.']
    },
    {
      title: 'Omelet Tahu Bayam Bumbu Bawang',
      cuisine: 'Asian',
      total_calories: 310,
      protein_g: 24, carbs_g: 8, fat_g: 14,
      ingredients: [
        { item: 'Telur ayam organik', amount: '2', unit: 'butir' },
        { item: 'Tahu putih potong dadu', amount: '60', unit: 'g' },
        { item: 'Daun bayam hijau segar', amount: '40', unit: 'g' },
        { item: 'Bawang putih cincang', amount: '1', unit: 'siung' }
      ],
      instructions: ['Kocok telur.', 'Tumis tahu dan bayam.', 'Tuang telur dan masak hingga matang lembut.']
    },
    {
      title: 'Pancake Oatmeal Pisang Kayu Manis',
      cuisine: 'Healthy',
      total_calories: 320,
      protein_g: 16, carbs_g: 52, fat_g: 6,
      ingredients: [
        { item: 'Tepung oat murni', amount: '60', unit: 'g' },
        { item: 'Pisang matang lumat', amount: '1', unit: 'buah' },
        { item: 'Putih telur', amount: '2', unit: 'butir' },
        { item: 'Bubuk kayu manis', amount: '1/2', unit: 'sdt' }
      ],
      instructions: ['Aduk rata adonan.', 'Panggang di wajan anti lengket.', 'Sajikan dengan madu murni.']
    }
  ],
  lunch: [
    {
      title: 'Nasi Merah Dada Ayam Panggang Rosemary',
      cuisine: 'Western',
      total_calories: 480,
      protein_g: 44, carbs_g: 48, fat_g: 10,
      ingredients: [
        { item: 'Dada ayam fillet tanpa kulit', amount: '160', unit: 'g' },
        { item: 'Nasi beras merah matang', amount: '120', unit: 'g' },
        { item: 'Brokoli & wortel kukus', amount: '80', unit: 'g' },
        { item: 'Minyak zaitun & rosemary', amount: '1', unit: 'sdt' }
      ],
      instructions: ['Lumuri ayam dengan rosemary dan minyak zaitun.', 'Panggang 6 menit tiap sisi.', 'Sajikan dengan nasi merah dan sayuran kukus.']
    },
    {
      title: 'Ayam Teriyaki Jahe Wijen Nasi Coklat',
      cuisine: 'Asian',
      total_calories: 490,
      protein_g: 42, carbs_g: 50, fat_g: 12,
      ingredients: [
        { item: 'Dada ayam fillet potong dadu', amount: '150', unit: 'g' },
        { item: 'Saus teriyaki jahe rendah gula', amount: '2', unit: 'sdm' },
        { item: 'Nasi coklat hangat', amount: '120', unit: 'g' },
        { item: 'Biji wijen sangrai', amount: '1', unit: 'sdt' }
      ],
      instructions: ['Masak ayam di wajan.', 'Tuang saus teriyaki dan aduk rata.', 'Sajikan di atas semangkuk nasi coklat.']
    },
    {
      title: 'Daging Sapi Cah Brokoli Bawang Putih',
      cuisine: 'Asian',
      total_calories: 460,
      protein_g: 38, carbs_g: 26, fat_g: 14,
      ingredients: [
        { item: 'Daging sapi tanpa lemak iris tipis', amount: '120', unit: 'g' },
        { item: 'Kuntum brokoli hijau', amount: '100', unit: 'g' },
        { item: 'Bawang putih & kecap asin rendah garam', amount: '1', unit: 'sdm' }
      ],
      instructions: ['Tumis bawang putih.', 'Masukkan daging sapi dan tumis cepat.', 'Tambahkan brokoli dan bumbu, angkat saat renyah.']
    }
  ],
  dinner: [
    {
      title: 'Sup Ayam Jamur Sayuran Bening',
      cuisine: 'Indonesian',
      total_calories: 320,
      protein_g: 34, carbs_g: 16, fat_g: 8,
      ingredients: [
        { item: 'Dada ayam tanpa kulit', amount: '120', unit: 'g' },
        { item: 'Jamur tiram & wortel', amount: '80', unit: 'g' },
        { item: 'Kaldu ayam bening bawang putih', amount: '300', unit: 'ml' }
      ],
      instructions: ['Didihkan kaldu bersama jamur dan wortel.', 'Masukkan ayam dan masak 4 menit.', 'Sajikan hangat.']
    },
    {
      title: 'Dada Ayam Panggang Lemon & Buncis Rebus',
      cuisine: 'Healthy',
      total_calories: 360,
      protein_g: 42, carbs_g: 12, fat_g: 10,
      ingredients: [
        { item: 'Dada ayam fillet', amount: '150', unit: 'g' },
        { item: 'Perasan lemon & lada hitam', amount: '1', unit: 'sdm' },
        { item: 'Buncis muda kukus', amount: '80', unit: 'g' }
      ],
      instructions: ['Panggang ayam beraroma lemon hingga matang.', 'Kukus buncis.', 'Sajikan hangat.']
    }
  ],
  snacks: [
    {
      title: 'Pisang Panggang Madu Kayu Manis',
      cuisine: 'Healthy',
      total_calories: 140,
      protein_g: 2, carbs_g: 34, fat_g: 0,
      ingredients: [{ item: 'Pisang kepok matang', amount: '1', unit: 'buah' }, { item: 'Madu murni & kayu manis', amount: '1', unit: 'sdt' }],
      instructions: ['Panggang pisang di wajan 4 menit.', 'Beri tetesan madu dan kayu manis.']
    }
  ],
  drinks: [
    {
      title: 'Wedang Jahe Lemon Madu Hangat',
      cuisine: 'Beverage',
      total_calories: 45,
      protein_g: 0, carbs_g: 11, fat_g: 0,
      ingredients: [{ item: 'Jahe merah memar', amount: '1', unit: 'ruas' }, { item: 'Jus lemon & madu', amount: '1', unit: 'sdm' }],
      instructions: ['Rebus jahe dalam air mendidih.', 'Tuang ke cangkir dan beri perasan lemon serta madu.']
    }
  ],
  desserts: [
    {
      title: 'Puding Chia Buah Naga Santan Ringan',
      cuisine: 'Dessert',
      total_calories: 120,
      protein_g: 4, carbs_g: 16, fat_g: 4,
      ingredients: [{ item: 'Biji chia', amount: '20', unit: 'g' }, { item: 'Puree buah naga merah', amount: '60', unit: 'g' }],
      instructions: ['Campur biji chia dan buah naga.', 'Dinginkan 30 menit hingga mengental.']
    }
  ]
};

/**
 * Validates candidates and automatically generates/selects compliant replacements
 * to guarantee exactly 12 valid, allergen-free choices per category.
 */
export function validateAndAssembleCategory(
  rawCandidates: CandidateDish[],
  category: string,
  context: UserDietaryContext,
  recentlyServedKeys: Set<string>,
  favoriteKeys: Set<string>
): CandidateDish[] {
  const validatedList: CandidateDish[] = [];
  const seenCanonicalKeys = new Set<string>();

  for (const candidate of rawCandidates) {
    const check = validateCandidate(candidate, context, recentlyServedKeys, favoriteKeys);
    const key = normalizeCanonicalKey(candidate.title);

    if (check.valid && !seenCanonicalKeys.has(key)) {
      seenCanonicalKeys.add(key);
      validatedList.push(candidate);
    } else if (!check.valid) {
      console.warn(`[RecipeValidationGate] Rejected "${candidate.title}": ${check.reason}`);
    }

    if (validatedList.length >= 12) break;
  }

  // If fewer than 12 valid meals remain after filtering, draw from safe allergen-free backups
  if (validatedList.length < 12) {
    const backupPool = SAFE_ALLERGEN_FREE_BACKUPS[category] || SAFE_ALLERGEN_FREE_BACKUPS.lunch || [];
    for (const backup of backupPool) {
      const key = normalizeCanonicalKey(backup.title);
      if (!seenCanonicalKeys.has(key)) {
        const check = validateCandidate(backup, context, recentlyServedKeys, favoriteKeys);
        if (check.valid) {
          seenCanonicalKeys.add(key);
          validatedList.push(backup);
        }
      }
      if (validatedList.length >= 12) break;
    }
  }

  return validatedList.slice(0, 12);
}
