/**
 * FoodColoringService
 * Deterministic detection and classification of food colorings and additives.
 * Uses official E-number classifications (E100-E199), US FD&C dye designations,
 * and international / Indonesian ingredient synonyms. Zero hallucination.
 */

export interface FoodColoringResult {
  status: 'verified_colorings' | 'verified_none' | 'unknown';
  is_unknown?: boolean;
  has_colorings: boolean;
  has_synthetic: boolean;
  synthetic_colors: string[];
  natural_colors: string[];
  summary: string;
}

interface ColorDefinition {
  canonicalName: string;
  isSynthetic: boolean;
  eCodes: string[];
  keywords: string[];
}

const COLOR_DATABASE: ColorDefinition[] = [
  // ─── SYNTHETIC / ARTIFICIAL COLORINGS ───
  {
    canonicalName: 'Tartrazine (Yellow 5 / E102)',
    isSynthetic: true,
    eCodes: ['e102', '102'],
    keywords: [
      'tartrazine',
      'tartrazin',
      'yellow 5',
      'yellow #5',
      'yellow no. 5',
      'yellow no 5',
      'fd&c yellow 5',
      'fd&c yellow #5',
      'fd&c yellow no. 5',
      'yellow 5 lake',
      'ci 19140',
      'pewarna sintetik tartrazin',
      'e102'
    ]
  },
  {
    canonicalName: 'Quinoline Yellow (E104)',
    isSynthetic: true,
    eCodes: ['e104', '104'],
    keywords: ['quinoline yellow', 'kuning kuinolin', 'ci 47005', 'e104']
  },
  {
    canonicalName: 'Sunset Yellow FCF (Yellow 6 / E110)',
    isSynthetic: true,
    eCodes: ['e110', '110'],
    keywords: [
      'sunset yellow',
      'kuning fcf',
      'yellow 6',
      'yellow #6',
      'yellow no. 6',
      'yellow no 6',
      'fd&c yellow 6',
      'fd&c yellow #6',
      'fd&c yellow no. 6',
      'yellow 6 lake',
      'orange yellow s',
      'ci 15985',
      'pewarna sintetik kuning fcf',
      'e110'
    ]
  },
  {
    canonicalName: 'Carmoisine / Azorubine (E122)',
    isSynthetic: true,
    eCodes: ['e122', '122'],
    keywords: ['carmoisine', 'karmoisin', 'azorubine', 'azorubin', 'ci 14720', 'e122']
  },
  {
    canonicalName: 'Amaranth (E123)',
    isSynthetic: true,
    eCodes: ['e123', '123'],
    keywords: ['amaranth dye', 'fd&c red 2', 'ci 16185', 'e123']
  },
  {
    canonicalName: 'Ponceau 4R (E124)',
    isSynthetic: true,
    eCodes: ['e124', '124'],
    keywords: ['ponceau 4r', 'cochineal red a', 'ci 16255', 'pewarna sintetik ponceau', 'e124']
  },
  {
    canonicalName: 'Erythrosine (Red 3 / E127)',
    isSynthetic: true,
    eCodes: ['e127', '127'],
    keywords: [
      'erythrosine',
      'eritrosin',
      'red 3',
      'red #3',
      'red no. 3',
      'red no 3',
      'fd&c red 3',
      'fd&c red #3',
      'fd&c red no. 3',
      'ci 45430',
      'e127'
    ]
  },
  {
    canonicalName: 'Allura Red AC (Red 40 / E129)',
    isSynthetic: true,
    eCodes: ['e129', '129'],
    keywords: [
      'allura red',
      'alura merah',
      'red 40',
      'red #40',
      'red no. 40',
      'red no 40',
      'fd&c red 40',
      'fd&c red #40',
      'fd&c red no. 40',
      'red 40 lake',
      'ci 16035',
      'pewarna sintetik alura merah',
      'e129'
    ]
  },
  {
    canonicalName: 'Patent Blue V (E131)',
    isSynthetic: true,
    eCodes: ['e131', '131'],
    keywords: ['patent blue', 'ci 42051', 'e131']
  },
  {
    canonicalName: 'Indigotine (Blue 2 / E132)',
    isSynthetic: true,
    eCodes: ['e132', '132'],
    keywords: [
      'indigotine',
      'indigo carmine',
      'blue 2',
      'blue #2',
      'blue no. 2',
      'blue no 2',
      'fd&c blue 2',
      'fd&c blue #2',
      'fd&c blue no. 2',
      'blue 2 lake',
      'ci 73015',
      'e132'
    ]
  },
  {
    canonicalName: 'Brilliant Blue FCF (Blue 1 / E133)',
    isSynthetic: true,
    eCodes: ['e133', '133'],
    keywords: [
      'brilliant blue',
      'biru berlian',
      'blue 1',
      'blue #1',
      'blue no. 1',
      'blue no 1',
      'fd&c blue 1',
      'fd&c blue #1',
      'fd&c blue no. 1',
      'blue 1 lake',
      'ci 42090',
      'pewarna sintetik biru berlian',
      'e133'
    ]
  },
  {
    canonicalName: 'Green S (E142)',
    isSynthetic: true,
    eCodes: ['e142', '142'],
    keywords: ['green s', 'ci 44090', 'e142']
  },
  {
    canonicalName: 'Fast Green FCF (Green 3 / E143)',
    isSynthetic: true,
    eCodes: ['e143', '143'],
    keywords: [
      'fast green',
      'green 3',
      'green #3',
      'green no. 3',
      'fd&c green 3',
      'fd&c green #3',
      'ci 42053',
      'e143'
    ]
  },
  {
    canonicalName: 'Brilliant Black BN (E151)',
    isSynthetic: true,
    eCodes: ['e151', '151'],
    keywords: ['brilliant black', 'ci 28440', 'e151']
  },
  {
    canonicalName: 'Brown HT (E155)',
    isSynthetic: true,
    eCodes: ['e155', '155'],
    keywords: ['brown ht', 'ci 20285', 'e155']
  },
  {
    canonicalName: 'Titanium Dioxide (E171)',
    isSynthetic: true,
    eCodes: ['e171', '171'],
    keywords: ['titanium dioxide', 'titanium dioksida', 'ci 77891', 'e171']
  },

  // ─── NATURAL / CARAMEL / MINERAL COLORINGS ───
  {
    canonicalName: 'Curcumin / Turmeric Extract (E100)',
    isSynthetic: false,
    eCodes: ['e100', '100'],
    keywords: ['curcumin', 'kurkumin', 'turmeric extract', 'turmeric color', 'pewarna alami kurkumin', 'e100']
  },
  {
    canonicalName: 'Riboflavin Coloring (E101)',
    isSynthetic: false,
    eCodes: ['e101', '101'],
    keywords: ['e101', 'pewarna riboflavin', 'colour: riboflavin', 'color: riboflavin', 'color (riboflavin)']
  },
  {
    canonicalName: 'Carmine / Cochineal (E120)',
    isSynthetic: false,
    eCodes: ['e120', '120'],
    keywords: ['carmine', 'karmin', 'cochineal', 'carminic acid', 'ci 75470', 'pewarna alami karmin', 'e120']
  },
  {
    canonicalName: 'Chlorophyll / Chlorophyllin (E140 / E141)',
    isSynthetic: false,
    eCodes: ['e140', 'e141', '140', '141'],
    keywords: ['chlorophyll', 'klorofil', 'chlorophyllin', 'copper complexes of chlorophylls', 'e140', 'e141']
  },
  {
    canonicalName: 'Caramel Color (Class I–IV / E150a–d)',
    isSynthetic: false,
    eCodes: ['e150a', 'e150b', 'e150c', 'e150d', '150a', '150b', '150c', '150d', 'e150'],
    keywords: [
      'caramel color',
      'caramel colour',
      'colour: caramel',
      'color: caramel',
      'pewarna karamel',
      'pewarna alami karamel',
      'warna karamel',
      'caramel iv',
      'caramel iii',
      'class iv caramel',
      'ammonia caramel',
      'sulfite ammonia caramel',
      'e150a',
      'e150b',
      'e150c',
      'e150d',
      'e150'
    ]
  },
  {
    canonicalName: 'Vegetable Carbon (E153)',
    isSynthetic: false,
    eCodes: ['e153', '153'],
    keywords: ['vegetable carbon', 'e153']
  },
  {
    canonicalName: 'Beta-Carotene / Carotenes (E160a)',
    isSynthetic: false,
    eCodes: ['e160a', 'e160', '160a', '160'],
    keywords: [
      'beta-carotene',
      'beta karoten',
      'beta carotene',
      'pewarna alami beta-karoten',
      'mixed carotenes',
      'carotene color',
      'e160a',
      'e160'
    ]
  },
  {
    canonicalName: 'Annatto / Bixin (E160b)',
    isSynthetic: false,
    eCodes: ['e160b', '160b'],
    keywords: ['annatto', 'anato', 'bixin', 'norbixin', 'ekstrak anato', 'e160b']
  },
  {
    canonicalName: 'Paprika Extract / Capsanthin (E160c)',
    isSynthetic: false,
    eCodes: ['e160c', '160c'],
    keywords: ['paprika extract', 'paprika oleoresin', 'ekstrak paprika', 'capsanthin', 'capsorubin', 'e160c']
  },
  {
    canonicalName: 'Lycopene (E160d)',
    isSynthetic: false,
    eCodes: ['e160d', '160d'],
    keywords: ['lycopene color', 'e160d']
  },
  {
    canonicalName: 'Lutein (E161b)',
    isSynthetic: false,
    eCodes: ['e161b', '161b'],
    keywords: ['e161b', 'pewarna lutein']
  },
  {
    canonicalName: 'Beetroot Red / Betanin (E162)',
    isSynthetic: false,
    eCodes: ['e162', '162'],
    keywords: ['beetroot red', 'bit merah', 'betanin', 'beet red', 'beet juice color', 'e162']
  },
  {
    canonicalName: 'Anthocyanins / Fruit & Vegetable Juice Color (E163)',
    isSynthetic: false,
    eCodes: ['e163', '163'],
    keywords: [
      'anthocyanin',
      'anthocyanins',
      'antosianin',
      'grape skin extract',
      'vegetable juice for color',
      'fruit and vegetable juice for color',
      'e163'
    ]
  },
  {
    canonicalName: 'Iron Oxides (E172)',
    isSynthetic: false,
    eCodes: ['e172', '172'],
    keywords: ['iron oxide', 'iron oxides', 'e172']
  }
];

export class FoodColoringService {
  /**
   * Deterministically identifies food colorings from real declared ingredient text and additive tags.
   * When ingredients and additive tags are both absent/unavailable, returns `status: 'unknown'`
   * instead of falsely claiming no colorings are present.
   */
  static analyze(ingredientsText?: string | null, additiveTags?: string[] | null): FoodColoringResult {
    const rawIngredients = (ingredientsText || '').trim();
    const isPlaceholderOrEmpty =
      !rawIngredients ||
      rawIngredients.toLowerCase().includes('not listed in database') ||
      rawIngredients.toLowerCase().includes('not declared') ||
      rawIngredients.toLowerCase().includes('unavailable');

    const normalizedTags = (additiveTags || [])
      .map(t => String(t).toLowerCase().replace(/^[a-z]+:/, '').trim())
      .filter(Boolean);

    // If neither real ingredients nor additive tags are available, return explicit unknown state
    if (isPlaceholderOrEmpty && normalizedTags.length === 0) {
      return {
        status: 'unknown',
        is_unknown: true,
        has_colorings: false,
        has_synthetic: false,
        synthetic_colors: [],
        natural_colors: [],
        summary: 'Ingredients unavailable in catalog — food coloring status cannot be verified'
      };
    }

    const syntheticFound = new Set<string>();
    const naturalFound = new Set<string>();
    const normalizedIngredients = isPlaceholderOrEmpty ? '' : rawIngredients.toLowerCase();

    // 1. Check against Open Food Facts additives tags (exact E-numbers)
    for (const tag of normalizedTags) {
      for (const def of COLOR_DATABASE) {
        if (def.eCodes.includes(tag)) {
          if (def.isSynthetic) {
            syntheticFound.add(def.canonicalName);
          } else {
            naturalFound.add(def.canonicalName);
          }
        }
      }
    }

    // 2. Check real ingredient text for explicit color declarations
    if (normalizedIngredients) {
      for (const def of COLOR_DATABASE) {
        for (const kw of def.keywords) {
          // Use boundary-aware check for short E-codes or dye codes
          const isShortCode = /^e\d{3}[a-z]?$/i.test(kw);
          const matched = isShortCode
            ? new RegExp(`\\b${kw}\\b`, 'i').test(normalizedIngredients)
            : normalizedIngredients.includes(kw);

          if (matched) {
            if (def.isSynthetic) {
              syntheticFound.add(def.canonicalName);
            } else {
              naturalFound.add(def.canonicalName);
            }
            break;
          }
        }
      }

      // General coloring statements if specific pigment is unstated
      if (syntheticFound.size === 0) {
        if (
          normalizedIngredients.includes('pewarna sintetik') ||
          normalizedIngredients.includes('pewarna buatan') ||
          normalizedIngredients.includes('artificial color') ||
          normalizedIngredients.includes('artificial colour') ||
          normalizedIngredients.includes('synthetic color') ||
          normalizedIngredients.includes('fd&c ')
        ) {
          syntheticFound.add('Declared Artificial / Synthetic Color');
        }
      }

      if (naturalFound.size === 0) {
        if (
          normalizedIngredients.includes('pewarna alami') ||
          normalizedIngredients.includes('natural color') ||
          normalizedIngredients.includes('natural colour')
        ) {
          naturalFound.add('Declared Natural Color (Plant / Mineral Derived)');
        }
      }
    }

    const syntheticList = Array.from(syntheticFound);
    const naturalList = Array.from(naturalFound);
    const hasSynthetic = syntheticList.length > 0;
    const hasColorings = hasSynthetic || naturalList.length > 0;

    let summary = 'No added food colorings detected in declared ingredients';
    if (hasSynthetic && naturalList.length > 0) {
      summary = `Contains synthetic coloring (${syntheticList.join(', ')}) and natural coloring (${naturalList.join(', ')})`;
    } else if (hasSynthetic) {
      summary = `Contains synthetic coloring: ${syntheticList.join(', ')}`;
    } else if (naturalList.length > 0) {
      summary = `Contains natural coloring: ${naturalList.join(', ')}`;
    }

    return {
      status: hasColorings ? 'verified_colorings' : 'verified_none',
      is_unknown: false,
      has_colorings: hasColorings,
      has_synthetic: hasSynthetic,
      synthetic_colors: syntheticList,
      natural_colors: naturalList,
      summary
    };
  }
}
