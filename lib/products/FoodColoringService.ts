/**
 * FoodColoringService
 * Deterministic detection and classification of food colorings and additives.
 * Uses official E-number classifications (E100-E199) and common international
 * & Indonesian ingredient synonyms. Zero hallucination.
 */

export interface FoodColoringResult {
  has_colorings: boolean;
  has_synthetic: boolean;
  synthetic_colors: string[];
  natural_colors: string[];
  summary: string;
}

// Canonical E-number and name definitions for food colorings
interface ColorDefinition {
  canonicalName: string;
  isSynthetic: boolean;
  eCodes: string[]; // e.g. ['e102', '102']
  keywords: string[]; // international & Indonesian aliases
}

const COLOR_DATABASE: ColorDefinition[] = [
  // ─── SYNTHETIC / ARTIFICIAL COLORINGS ───
  {
    canonicalName: 'Tartrazine (Yellow 5 / CI 19140)',
    isSynthetic: true,
    eCodes: ['e102', '102'],
    keywords: ['tartrazine', 'tartrazin', 'yellow 5', 'fd&c yellow no. 5', 'ci 19140', 'pewarna sintetik tartrazin']
  },
  {
    canonicalName: 'Sunset Yellow FCF (Yellow 6 / CI 15985)',
    isSynthetic: true,
    eCodes: ['e110', '110'],
    keywords: ['sunset yellow', 'kuning fcf', 'yellow 6', 'fd&c yellow no. 6', 'ci 15985', 'pewarna sintetik kuning fcf']
  },
  {
    canonicalName: 'Carmoisine / Azorubine (CI 14720)',
    isSynthetic: true,
    eCodes: ['e122', '122'],
    keywords: ['carmoisine', 'karmoisin', 'azorubine', 'azorubin', 'ci 14720']
  },
  {
    canonicalName: 'Ponceau 4R (CI 16255)',
    isSynthetic: true,
    eCodes: ['e124', '124'],
    keywords: ['ponceau 4r', 'cochineal red a', 'ci 16255', 'pewarna sintetik ponceau']
  },
  {
    canonicalName: 'Erythrosine (Red 3 / CI 45430)',
    isSynthetic: true,
    eCodes: ['e127', '127'],
    keywords: ['erythrosine', 'eritrosin', 'red 3', 'fd&c red no. 3', 'ci 45430']
  },
  {
    canonicalName: 'Allura Red AC (Red 40 / CI 16035)',
    isSynthetic: true,
    eCodes: ['e129', '129'],
    keywords: ['allura red', 'alura merah', 'red 40', 'fd&c red no. 40', 'ci 16035', 'pewarna sintetik alura merah']
  },
  {
    canonicalName: 'Indigotine (Blue 2 / CI 73015)',
    isSynthetic: true,
    eCodes: ['e132', '132'],
    keywords: ['indigotine', 'indigo carmine', 'blue 2', 'ci 73015']
  },
  {
    canonicalName: 'Brilliant Blue FCF (Blue 1 / CI 42090)',
    isSynthetic: true,
    eCodes: ['e133', '133'],
    keywords: ['brilliant blue', 'biru berlian', 'blue 1', 'fd&c blue no. 1', 'ci 42090', 'pewarna sintetik biru berlian']
  },
  {
    canonicalName: 'Fast Green FCF (Green 3 / CI 42053)',
    isSynthetic: true,
    eCodes: ['e143', '143'],
    keywords: ['fast green', 'green 3', 'ci 42053']
  },
  {
    canonicalName: 'Titanium Dioxide (CI 77891)',
    isSynthetic: true,
    eCodes: ['e171', '171'],
    keywords: ['titanium dioxide', 'titanium dioksida', 'ci 77891']
  },

  // ─── NATURAL COLORINGS ───
  {
    canonicalName: 'Curcumin / Turmeric Extract (E100)',
    isSynthetic: false,
    eCodes: ['e100', '100'],
    keywords: ['curcumin', 'kurkumin', 'turmeric', 'kunyit', 'pewarna alami kurkumin']
  },
  {
    canonicalName: 'Riboflavin / Vitamin B2 (E101)',
    isSynthetic: false,
    eCodes: ['e101', '101'],
    keywords: ['riboflavin', 'lactoflavin']
  },
  {
    canonicalName: 'Chlorophyll / Chlorophyllin (E140 / E141)',
    isSynthetic: false,
    eCodes: ['e140', 'e141', '140', '141'],
    keywords: ['chlorophyll', 'klorofil', 'chlorophyllin', 'copper complexes of chlorophylls']
  },
  {
    canonicalName: 'Caramel Color (Class I-IV / E150a-d)',
    isSynthetic: false,
    eCodes: ['e150a', 'e150b', 'e150c', 'e150d', '150a', '150b', '150c', '150d', 'e150'],
    keywords: ['caramel color', 'karamel', 'pewarna alami karamel', 'caramel iv', 'caramel iii', 'ammonia caramel']
  },
  {
    canonicalName: 'Beta-Carotene (E160a)',
    isSynthetic: false,
    eCodes: ['e160a', 'e160', '160a', '160'],
    keywords: ['beta-carotene', 'beta karoten', 'beta carotene', 'pewarna alami beta-karoten', 'carotenes']
  },
  {
    canonicalName: 'Annatto / Bixin (E160b)',
    isSynthetic: false,
    eCodes: ['e160b', '160b'],
    keywords: ['annatto', 'anato', 'bixin', 'norbixin', 'ekstrak anato']
  },
  {
    canonicalName: 'Paprika Extract / Capsanthin (E160c)',
    isSynthetic: false,
    eCodes: ['e160c', '160c'],
    keywords: ['paprika extract', 'ekstrak paprika', 'capsanthin', 'capsorubin']
  },
  {
    canonicalName: 'Beetroot Red / Betanin (E162)',
    isSynthetic: false,
    eCodes: ['e162', '162'],
    keywords: ['beetroot red', 'bit merah', 'betanin', 'beet red']
  },
  {
    canonicalName: 'Anthocyanins / Grape Skin Extract (E163)',
    isSynthetic: false,
    eCodes: ['e163', '163'],
    keywords: ['anthocyanin', 'antosianin', 'grape skin extract']
  }
];

export class FoodColoringService {
  /**
   * Deterministically identifies food colorings from additives tags and ingredient text.
   */
  static analyze(ingredientsText?: string | null, additiveTags?: string[] | null): FoodColoringResult {
    const syntheticFound = new Set<string>();
    const naturalFound = new Set<string>();

    const normalizedIngredients = (ingredientsText || '').toLowerCase();
    const normalizedTags = (additiveTags || []).map(t => t.toLowerCase().replace(/^[a-z]+:/, '').trim());

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

    // 2. Check ingredient text for explicit color declarations
    if (normalizedIngredients) {
      for (const def of COLOR_DATABASE) {
        for (const kw of def.keywords) {
          if (normalizedIngredients.includes(kw)) {
            if (def.isSynthetic) {
              syntheticFound.add(def.canonicalName);
            } else {
              naturalFound.add(def.canonicalName);
            }
            break;
          }
        }
      }

      // Check general Indonesian / English coloring statements if specific color not caught
      if (syntheticFound.size === 0) {
        if (
          normalizedIngredients.includes('pewarna sintetik') ||
          normalizedIngredients.includes('pewarna buatan') ||
          normalizedIngredients.includes('artificial color') ||
          normalizedIngredients.includes('synthetic color')
        ) {
          syntheticFound.add('Declared Synthetic Color (Specific pigment unstated)');
        }
      }

      if (naturalFound.size === 0) {
        if (
          normalizedIngredients.includes('pewarna alami') ||
          normalizedIngredients.includes('natural color')
        ) {
          naturalFound.add('Declared Natural Color (Plant/Mineral derived)');
        }
      }
    }

    const syntheticList = Array.from(syntheticFound);
    const naturalList = Array.from(naturalFound);
    const hasSynthetic = syntheticList.length > 0;
    const hasColorings = hasSynthetic || naturalList.length > 0;

    let summary = 'No added food colorings detected';
    if (hasSynthetic && naturalList.length > 0) {
      summary = `Contains both synthetic colors (${syntheticList.join(', ')}) and natural colors (${naturalList.join(', ')})`;
    } else if (hasSynthetic) {
      summary = `Contains synthetic coloring: ${syntheticList.join(', ')}`;
    } else if (naturalList.length > 0) {
      summary = `Contains natural coloring: ${naturalList.join(', ')}`;
    }

    return {
      has_colorings: hasColorings,
      has_synthetic: hasSynthetic,
      synthetic_colors: syntheticList,
      natural_colors: naturalList,
      summary
    };
  }
}
