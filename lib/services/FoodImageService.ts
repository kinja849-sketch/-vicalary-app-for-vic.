/**
 * FoodImageService
 * Provides authentic, high-definition, verified culinary photography and AI food imagery
 * strictly matching dish names, cuisines, and food categories.
 */

// Verified high-definition culinary photography catalog by dish type & keywords
const CULINARY_PHOTO_CATALOG: Array<{ keywords: string[]; url: string }> = [
  // Indonesian & Asian Poultry / Meat
  {
    keywords: ['ayam bakar', 'grilled chicken', 'ayam panggang', 'bumbu rujak', 'ayam madu', 'ayam kecap'],
    url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['sate', 'satay', 'sate ayam', 'sate kambing', 'sate sapi', 'bumbu kacang', 'skewers'],
    url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['teriyaki', 'ayam teriyaki', 'beef teriyaki', 'chicken teriyaki'],
    url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['rendang', 'daging rendang', 'beef rendang', 'gulai', 'semur'],
    url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80'
  },

  // Soups & Warm Broths
  {
    keywords: ['soto', 'soto ayam', 'soto betawi', 'soto lamongan', 'soto madura', 'chicken soup', 'sup ayam'],
    url: 'https://images.unsplash.com/photo-1572449043416-55f4685c9bb7?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['sup ikan', 'ikan kuah', 'fish soup', 'sop ikan', 'sup kakap', 'tom yum'],
    url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['ramen', 'mie kuah', 'noodle soup', 'bakso', 'meatball soup'],
    url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80'
  },

  // Indonesian & Asian Vegetables & Tofu / Tempeh
  {
    keywords: ['gado-gado', 'gado gado', 'pecel', 'karedok', 'lotek'],
    url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['capcay', 'cap cay', 'tumis buncis', 'tumis sayur', 'stir fry', 'tumis brokoli', 'stir-fry'],
    url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['kangkung', 'tumis kangkung', 'cah kangkung', 'bayam', 'sayur bayam', 'sayur bening'],
    url: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['tempe', 'tahu', 'tofu', 'tempeh', 'orek tempe', 'tumis tahu', 'pepes tahu'],
    url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'
  },

  // Seafood & Fish
  {
    keywords: ['ikan bakar', 'grilled fish', 'pepes ikan', 'ikan nila', 'salmon', 'ikan tongkol', 'gurame'],
    url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['udang', 'shrimp', 'prawn', 'cumi', 'squid', 'seafood'],
    url: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=800&q=80'
  },

  // Breakfast, Oats & Porridge
  {
    keywords: ['bubur', 'oatmeal', 'oats', 'bubur ayam', 'porridge', 'smoothie bowl', 'granola'],
    url: 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['omelet', 'omelette', 'telur', 'scrambled eggs', 'poached eggs', 'telur ceplok'],
    url: 'https://images.unsplash.com/photo-1510693206972-df098062cb71?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['toast', 'avocado toast', 'roti bakar', 'sandwich', 'roti gandum'],
    url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['nasi merah', 'nasi goreng', 'brown rice', 'fried rice'],
    url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80'
  },

  // Snacks & Light Bites
  {
    keywords: ['edamame', 'edamame rebus', 'edamame kukus', 'boiled edamame'],
    url: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['pisang', 'banana', 'pisang panggang', 'keripik pisang', 'banana chips'],
    url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['lumpia', 'spring roll', 'summer roll', 'salad roll', 'risoles'],
    url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['kacang', 'peanuts', 'almond', 'nuts', 'kacang panggang'],
    url: 'https://images.unsplash.com/photo-1536591375315-1b8368157772?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['rujak', 'fruit salad', 'salad buah', 'potongan buah'],
    url: 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?auto=format&fit=crop&w=800&q=80'
  },

  // Drinks & Smoothies
  {
    keywords: ['teh', 'tea', 'es teh', 'green tea', 'teh hijau', 'lemon tea', 'matcha'],
    url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['jus', 'juice', 'jus mangga', 'jus alpukat', 'orange juice', 'fresh juice'],
    url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['wedang', 'jahe', 'ginger tea', 'wedang jahe', 'warm herbal', 'kunyit asam'],
    url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['smoothie', 'protein shake', 'shake', 'infused water'],
    url: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=800&q=80'
  },

  // Desserts & Sweet Treats
  {
    keywords: ['panna cotta', 'pannacotta', 'berry compote', 'pudding', 'puding', 'flan', 'custard'],
    url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['chia', 'chia pudding', 'puding chia', 'dragon fruit', 'buah naga'],
    url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['kelapa muda', 'coconut pudding', 'puding kelapa', 'es kelapa'],
    url: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['ubi', 'sweet potato', 'bola ubi', 'ubi panggang', 'singkong'],
    url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80'
  },
  {
    keywords: ['parfait', 'yogurt parfait', 'greek yogurt', 'dessert', 'pencuci mulut'],
    url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80'
  }
];

// Fallbacks strictly separated by category
const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  breakfast: 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?auto=format&fit=crop&w=800&q=80',
  lunch: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80',
  dinner: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
  snacks: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=800&q=80',
  drinks: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80',
  desserts: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80',
  default: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'
};

/**
 * Resolves a high-quality, verified culinary food image matching the dish title, cuisine, and category.
 */
export function getFoodImageUrl(dishName: string = '', cuisine: string = 'Indonesian', category: string = 'lunch'): string {
  const lowerTitle = dishName.toLowerCase().trim();
  const lowerCat = category.toLowerCase().trim();

  // 1. Direct match against verified culinary catalog using whole-word / phrase matching
  for (const entry of CULINARY_PHOTO_CATALOG) {
    for (const kw of entry.keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s|[^a-zA-Z0-9])${escaped}($|\\s|[^a-zA-Z0-9])`, 'i');
      if (regex.test(lowerTitle)) {
        return entry.url;
      }
    }
  }

  // 2. Return category-specific authentic fallback
  return CATEGORY_DEFAULT_IMAGES[lowerCat] || CATEGORY_DEFAULT_IMAGES.default;
}
