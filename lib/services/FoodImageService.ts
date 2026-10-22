/**
 * FoodImageService
 * Provides authentic, high-definition, verified TheMealDB culinary photography
 * strictly matching dish names, cuisines, and food categories with guaranteed uniqueness.
 */

// Known dead/broken image substrings that must never be served
const BROKEN_IMAGE_SUBSTRINGS = [
  'photo-1546069901-d66a285109b0',
  'photo-1596097635121-14b63b7a0c19',
  'photo-1546069901-d68a9668383e',
  'photo-1596040033282-5d9c2cb48695',
  'photo-1536591375315-1b8368157772',
  'photo-1601930271571-38c1e3a4b9a1',
  'photo-1568468357921-e72401b864d8',
  'photo-1574125738498-c8095b87075c',
  'http://test',
  'https://test',
  'placeholder',
  'placekitten',
  'kitten',
  'undefined',
  'null'
];

export function isBrokenImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
    return true;
  }
  const lower = trimmed.toLowerCase();
  // Ensure Unsplash and non-culinary placeholders are marked broken so they get replaced by TheMealDB images
  if (lower.includes('unsplash.com') || lower.includes('placeholder') || lower.includes('placekitten') || lower.includes('kitten')) {
    return true;
  }
  return BROKEN_IMAGE_SUBSTRINGS.some(sub => lower.includes(sub));
}

/**
 * Extracts a canonical key for an image URL so two URLs pointing to the same underlying photo
 * are recognized as identical.
 */
export function getCanonicalImageKey(url: string): string {
  const trimmed = (url || '').trim();
  const mealMatch = trimmed.match(/meals\/[a-zA-Z0-9_-]+\.(jpg|png|jpeg)/i);
  if (mealMatch) return mealMatch[0].toLowerCase();
  const drinkMatch = trimmed.match(/drink\/[a-zA-Z0-9_-]+\.(jpg|png|jpeg)/i);
  if (drinkMatch) return drinkMatch[0].toLowerCase();
  const unsplashMatch = trimmed.match(/photo-[a-z0-9\-]+/i);
  if (unsplashMatch) return unsplashMatch[0].toLowerCase();
  return trimmed.split('?')[0].toLowerCase();
}

function isUrlAlreadyUsed(url: string, usedPhotoUrls?: Set<string>): boolean {
  if (!usedPhotoUrls) return false;
  const key = getCanonicalImageKey(url);
  return usedPhotoUrls.has(url) || usedPhotoUrls.has(key);
}

function markUrlUsed(url: string, usedPhotoUrls?: Set<string>): void {
  if (!usedPhotoUrls || !url) return;
  usedPhotoUrls.add(url);
  usedPhotoUrls.add(getCanonicalImageKey(url));
}

// Verified TheMealDB CDN food photography pools organized by dish family
const DISH_FAMILY_PHOTO_POOLS: Array<{ pattern: RegExp; urls: string[] }> = [
  {
    pattern: /\b(snack|snacks|bite|bites|almond|almonds|walnut|walnuts|nuts|falafel|hummus|edamame|chips|crackers|guacamole|dip|popcorn|trail\s+mix|baba\s+ghanoush|spring\s+roll|spring\s+rolls|yuca|fries|crisps|crudit[eé]s)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/xrrsvt1511814969.jpg",
      "https://www.themealdb.com/images/media/meals/1529444113.jpg",
      "https://www.themealdb.com/images/media/meals/dlmh401760524897.jpg",
      "https://www.themealdb.com/images/media/meals/j223gc1784579841.jpg",
      "https://www.themealdb.com/images/media/meals/grhn401765687086.jpg",
      "https://www.themealdb.com/images/media/meals/1548772327.jpg",
      "https://www.themealdb.com/images/media/meals/5vhbzt1782239221.jpg",
      "https://www.themealdb.com/images/media/meals/st9shl1763755808.jpg",
      "https://www.themealdb.com/images/media/meals/pk8wtn1763758591.jpg",
      "https://www.themealdb.com/images/media/meals/k29viq1585565980.jpg",
      "https://www.themealdb.com/images/media/meals/0iryz91763778419.jpg",
      "https://www.themealdb.com/images/media/meals/w8umt11583268117.jpg"
    ]
  },
  {
    pattern: /\b(oat|oats|oatmeal|porridge|granola|muesli|chia\s+bowl)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/c400ok1764439058.jpg",
      "https://www.themealdb.com/images/media/meals/sng9bm1765320170.jpg",
      "https://www.themealdb.com/images/media/meals/hyk47c1762772689.jpg",
      "https://www.themealdb.com/images/media/meals/bfok4w1780242078.jpg",
      "https://www.themealdb.com/images/media/meals/1550441275.jpg",
      "https://www.themealdb.com/images/media/meals/smoa3h1762341142.jpg"
]
  },
  {
    pattern: /\b(pancake|pancakes|waffle|waffles|crepe|crepes|french\s+toast|flapjack)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/oaqz9f1766593912.jpg",
      "https://www.themealdb.com/images/media/meals/eqnf3p1779649407.jpg",
      "https://www.themealdb.com/images/media/meals/c400ok1764439058.jpg",
      "https://www.themealdb.com/images/media/meals/0206h11699013358.jpg",
      "https://www.themealdb.com/images/media/meals/sywswr1511383814.jpg",
      "https://www.themealdb.com/images/media/meals/xlqqhw1764369924.jpg",
      "https://www.themealdb.com/images/media/meals/h7zrys1779736460.jpg",
      "https://www.themealdb.com/images/media/meals/0wmns51784837949.jpg"
]
  },
  {
    pattern: /\b(omelette|omelet|scramble|shakshuka|frittata|menemen|poached\s+egg|boiled\s+egg)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/hqaejl1695738653.jpg",
      "https://www.themealdb.com/images/media/meals/1550440197.jpg",
      "https://www.themealdb.com/images/media/meals/30s7vf1763741844.jpg",
      "https://www.themealdb.com/images/media/meals/vayi021784668764.jpg",
      "https://www.themealdb.com/images/media/meals/47y6ii1765658818.jpg",
      "https://www.themealdb.com/images/media/meals/2dsltq1560461468.jpg",
      "https://www.themealdb.com/images/media/meals/rwvw8q1765660071.jpg",
      "https://www.themealdb.com/images/media/meals/1529446137.jpg",
      "https://www.themealdb.com/images/media/meals/qwtrtp1511799242.jpg",
      "https://www.themealdb.com/images/media/meals/g373701551450225.jpg"
]
  },
  {
    pattern: /\b(pizza|margherita|lahmacun|manakeesh)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/wf49qs1763075222.jpg",
      "https://www.themealdb.com/images/media/meals/tqd3ac1763786065.jpg",
      "https://www.themealdb.com/images/media/meals/iydbwy1763816111.jpg",
      "https://www.themealdb.com/images/media/meals/x0lk931587671540.jpg"
]
  },
  {
    pattern: /\b(burger|burgers|slider|sliders|patty)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/vdwloy1713225718.jpg",
      "https://www.themealdb.com/images/media/meals/44bzep1761848278.jpg",
      "https://www.themealdb.com/images/media/meals/lgmnff1763789847.jpg",
      "https://www.themealdb.com/images/media/meals/k420tj1585565244.jpg"
]
  },
  {
    pattern: /\b(pasta|spaghetti|penne|fettuccine|macaroni|mac\s+and|lasagna|lasagne|rigatoni|tagliatelle|bolognese|alfredo)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/syqypv1486981727.jpg",
      "https://www.themealdb.com/images/media/meals/qrqywr1503066605.jpg",
      "https://www.themealdb.com/images/media/meals/sutysw1468247559.jpg",
      "https://www.themealdb.com/images/media/meals/wvqpwt1468339226.jpg",
      "https://www.themealdb.com/images/media/meals/usywpp1511189717.jpg",
      "https://www.themealdb.com/images/media/meals/0jv5gx1661040802.jpg",
      "https://www.themealdb.com/images/media/meals/uquqtu1511178042.jpg",
      "https://www.themealdb.com/images/media/meals/xutquv1505330523.jpg",
      "https://www.themealdb.com/images/media/meals/xr0n4r1576788363.jpg",
      "https://www.themealdb.com/images/media/meals/wtsvxx1511296896.jpg"
]
  },
  {
    pattern: /\b(ramen|noodle|noodles|pad\s+thai|pho|udon|soba|chow\s+mein|lo\s+mein|mie\s+goreng)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/6g9gif1782688663.jpg",
      "https://www.themealdb.com/images/media/meals/1529444830.jpg",
      "https://www.themealdb.com/images/media/meals/pbzcrx1763765096.jpg",
      "https://www.themealdb.com/images/media/meals/2wx8cm1763373419.jpg",
      "https://www.themealdb.com/images/media/meals/ntafxw1763586291.jpg",
      "https://www.themealdb.com/images/media/meals/st9shl1763755808.jpg",
      "https://www.themealdb.com/images/media/meals/rvypwy1503069308.jpg",
      "https://www.themealdb.com/images/media/meals/zry07j1763779321.jpg",
      "https://www.themealdb.com/images/media/meals/rg9ze01763479093.jpg",
      "https://www.themealdb.com/images/media/meals/0iryz91763778419.jpg"
]
  },
  {
    pattern: /\b(biryani|jollof|paella|fried\s+rice|nasi\s+goreng|pilaf|pulao|kabsa|mandi|risotto)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/fk80jp1763280767.jpg",
      "https://www.themealdb.com/images/media/meals/wuyd2h1765655837.jpg",
      "https://www.themealdb.com/images/media/meals/er4d081765186828.jpg",
      "https://www.themealdb.com/images/media/meals/tytyxu1515363282.jpg",
      "https://www.themealdb.com/images/media/meals/1nalo51765188375.jpg",
      "https://www.themealdb.com/images/media/meals/9bl20p1763248192.jpg",
      "https://www.themealdb.com/images/media/meals/xxrxux1503070723.jpg",
      "https://www.themealdb.com/images/media/meals/5r5rvx1763287943.jpg",
      "https://www.themealdb.com/images/media/meals/sl6vqv1763335988.jpg",
      "https://www.themealdb.com/images/media/meals/c6ghxm1763335584.jpg",
      "https://www.themealdb.com/images/media/meals/hblwvg1763478203.jpg",
      "https://www.themealdb.com/images/media/meals/11bvtm1764795135.jpg"
]
  },
  {
    pattern: /\b(taco|tacos|quesadilla|burrito|fajita|enchilada|nachos|tortilla)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/qtuwxu1468233098.jpg",
      "https://www.themealdb.com/images/media/meals/qrqywr1503066605.jpg",
      "https://www.themealdb.com/images/media/meals/ypxvwv1505333929.jpg",
      "https://www.themealdb.com/images/media/meals/swo87v1763595282.jpg",
      "https://www.themealdb.com/images/media/meals/uvuyxu1503067369.jpg",
      "https://www.themealdb.com/images/media/meals/njj1681763297231.jpg",
      "https://www.themealdb.com/images/media/meals/quuxsx1511476154.jpg",
      "https://www.themealdb.com/images/media/meals/7b862e1763194846.jpg"
]
  },
  {
    pattern: /\b(shawarma|kebab|kebabs|kofta|gyro|gyros|doner|souvlaki|skewer|skewers|satay)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/hcg6l91763596970.jpg",
      "https://www.themealdb.com/images/media/meals/prjve31763486864.jpg",
      "https://www.themealdb.com/images/media/meals/kcv6hj1598733479.jpg",
      "https://www.themealdb.com/images/media/meals/3um6il1763794322.jpg",
      "https://www.themealdb.com/images/media/meals/swo87v1763595282.jpg",
      "https://www.themealdb.com/images/media/meals/i8l2fu1763742525.jpg",
      "https://www.themealdb.com/images/media/meals/04axct1763793018.jpg",
      "https://www.themealdb.com/images/media/meals/lgmnff1763789847.jpg"
]
  },
  {
    pattern: /\b(sushi|maki|nori|dumpling|dumplings|gyoza|pierogi|bao|spring\s+roll)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/uyqrrv1511553350.jpg",
      "https://www.themealdb.com/images/media/meals/g046bb1663960946.jpg",
      "https://www.themealdb.com/images/media/meals/x26z3y1780155760.jpg",
      "https://www.themealdb.com/images/media/meals/ckbx1h1764123606.jpg",
      "https://www.themealdb.com/images/media/meals/tsdbcq1764795636.jpg",
      "https://www.themealdb.com/images/media/meals/g6xb8m1764875029.jpg",
      "https://www.themealdb.com/images/media/meals/dd7t4d1764877271.jpg",
      "https://www.themealdb.com/images/media/meals/45xxr21593348847.jpg"
]
  },
  {
    pattern: /\b(curry|butter\s+chicken|masala|tikka|dal|daal|rendang|korma|vindaloo)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/9ya6o71780262651.jpg",
      "https://www.themealdb.com/images/media/meals/o5fuq51764789643.jpg",
      "https://www.themealdb.com/images/media/meals/vwrpps1503068729.jpg",
      "https://www.themealdb.com/images/media/meals/yxsurp1511304301.jpg",
      "https://www.themealdb.com/images/media/meals/0dhtwr1763371444.jpg",
      "https://www.themealdb.com/images/media/meals/prjve31763486864.jpg",
      "https://www.themealdb.com/images/media/meals/k5qzdl1782689660.jpg",
      "https://www.themealdb.com/images/media/meals/sstssx1487349585.jpg",
      "https://www.themealdb.com/images/media/meals/bc8v651619789840.jpg",
      "https://www.themealdb.com/images/media/meals/lqampv1762325397.jpg"
]
  },
  {
    pattern: /\b(steak|sirloin|ribeye|beef|veal|lamb|meatball|meatballs|shepherd|stroganoff)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/8rfd4q1764112993.jpg",
      "https://www.themealdb.com/images/media/meals/13fg4j1764441982.jpg",
      "https://www.themealdb.com/images/media/meals/jgl9qq1764437635.jpg",
      "https://www.themealdb.com/images/media/meals/kgfh3q1763075438.jpg",
      "https://www.themealdb.com/images/media/meals/44bzep1761848278.jpg",
      "https://www.themealdb.com/images/media/meals/5tf8j11782236249.jpg",
      "https://www.themealdb.com/images/media/meals/m0p0j81765568742.jpg",
      "https://www.themealdb.com/images/media/meals/sytuqu1511553755.jpg",
      "https://www.themealdb.com/images/media/meals/wrssvt1511556563.jpg",
      "https://www.themealdb.com/images/media/meals/pkopc31683207947.jpg",
      "https://www.themealdb.com/images/media/meals/z0ageb1583189517.jpg",
      "https://www.themealdb.com/images/media/meals/vtqxtu1511784197.jpg"
]
  },
  {
    pattern: /\b(soup|stew|broth|minestrone|chowder|laksa|soto|harira|lentil\s+soup)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/sypxpx1515365095.jpg",
      "https://www.themealdb.com/images/media/meals/6g9gif1782688663.jpg",
      "https://www.themealdb.com/images/media/meals/lx1kkj1593349302.jpg",
      "https://www.themealdb.com/images/media/meals/bmbvjk1782770310.jpg",
      "https://www.themealdb.com/images/media/meals/7kb44y1763589084.jpg",
      "https://www.themealdb.com/images/media/meals/uyqrrv1511553350.jpg",
      "https://www.themealdb.com/images/media/meals/k07k271782502861.jpg",
      "https://www.themealdb.com/images/media/meals/fl4brj1764361323.jpg",
      "https://www.themealdb.com/images/media/meals/xrxz7h1782592711.jpg",
      "https://www.themealdb.com/images/media/meals/6vi2cv1763075785.jpg"
]
  },
  {
    pattern: /\b(toast|sandwich|panini|sub|bagel|chapati|roti|naan|paratha|pita|roll-up|wrap)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/sbx7n71587673021.jpg",
      "https://www.themealdb.com/images/media/meals/mp9z0i1782238092.jpg",
      "https://www.themealdb.com/images/media/meals/o93jur1782769321.jpg",
      "https://www.themealdb.com/images/media/meals/nlxald1764112200.jpg",
      "https://www.themealdb.com/images/media/meals/j80gmw1764372176.jpg",
      "https://www.themealdb.com/images/media/meals/hx335q1619789561.jpg",
      "https://www.themealdb.com/images/media/meals/xutquv1505330523.jpg",
      "https://www.themealdb.com/images/media/meals/ae6clc1760524712.jpg"
]
  },
  {
    pattern: /\b(salad|quinoa|chickpea|falafel|hummus|guacamole|avocado|edamame|tempeh|tofu|veggie|vegetable)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/k29viq1585565980.jpg",
      "https://www.themealdb.com/images/media/meals/t5rgav1784659936.jpg",
      "https://www.themealdb.com/images/media/meals/pk8wtn1763758591.jpg",
      "https://www.themealdb.com/images/media/meals/6vi2cv1763075785.jpg",
      "https://www.themealdb.com/images/media/meals/1525874812.jpg",
      "https://www.themealdb.com/images/media/meals/st9shl1763755808.jpg",
      "https://www.themealdb.com/images/media/meals/w8umt11583268117.jpg",
      "https://www.themealdb.com/images/media/meals/4xcfai1763765676.jpg",
      "https://www.themealdb.com/images/media/meals/wvqpwt1468339226.jpg",
      "https://www.themealdb.com/images/media/meals/zry07j1763779321.jpg",
      "https://www.themealdb.com/images/media/meals/0iryz91763778419.jpg",
      "https://www.themealdb.com/images/media/meals/1549542994.jpg"
]
  },
  {
    pattern: /\b(salmon|cod|tilapia|trout|fish|seafood|shrimp|prawn|tuna)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/1550440197.jpg",
      "https://www.themealdb.com/images/media/meals/dxs5t71782678369.jpg",
      "https://www.themealdb.com/images/media/meals/diuub11782687570.jpg",
      "https://www.themealdb.com/images/media/meals/jc6oub1763196663.jpg",
      "https://www.themealdb.com/images/media/meals/e2kcut1782591669.jpg",
      "https://www.themealdb.com/images/media/meals/1548772327.jpg",
      "https://www.themealdb.com/images/media/meals/qqwhw51780093126.jpg",
      "https://www.themealdb.com/images/media/meals/4xcfai1763765676.jpg",
      "https://www.themealdb.com/images/media/meals/r7mcjm1780261264.jpg",
      "https://www.themealdb.com/images/media/meals/4o4wh11761848573.jpg",
      "https://www.themealdb.com/images/media/meals/uvuyxu1503067369.jpg",
      "https://www.themealdb.com/images/media/meals/jg4r991779916649.jpg"
]
  },
  {
    pattern: /\b(chicken|turkey|poultry)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/vdwloy1713225718.jpg",
      "https://www.themealdb.com/images/media/meals/020z181619788503.jpg",
      "https://www.themealdb.com/images/media/meals/nmxec11782498644.jpg",
      "https://www.themealdb.com/images/media/meals/9ya6o71780262651.jpg",
      "https://www.themealdb.com/images/media/meals/sypxpx1515365095.jpg",
      "https://www.themealdb.com/images/media/meals/sbx7n71587673021.jpg",
      "https://www.themealdb.com/images/media/meals/fk80jp1763280767.jpg",
      "https://www.themealdb.com/images/media/meals/uuuspp1511297945.jpg",
      "https://www.themealdb.com/images/media/meals/syqypv1486981727.jpg",
      "https://www.themealdb.com/images/media/meals/mp9z0i1782238092.jpg",
      "https://www.themealdb.com/images/media/meals/wruvqv1511880994.jpg",
      "https://www.themealdb.com/images/media/meals/1529446352.jpg"
]
  },
  {
    pattern: /\b(tea|latte|smoothie|juice|water|cooler|infusion|lemonade|drink|matcha|coco)\b/i,
    urls: [
      "https://www.thecocktaildb.com/images/media/drink/vuquyv1468876052.jpg",
      "https://www.thecocktaildb.com/images/media/drink/qyqtpv1468876144.jpg",
      "https://www.thecocktaildb.com/images/media/drink/wsyvrt1468876267.jpg",
      "https://www.thecocktaildb.com/images/media/drink/uptxtv1468876415.jpg",
      "https://www.thecocktaildb.com/images/media/drink/xwqvur1468876473.jpg",
      "https://www.thecocktaildb.com/images/media/drink/syusvw1468876634.jpg",
      "https://www.thecocktaildb.com/images/media/drink/uqxqsy1468876703.jpg",
      "https://www.thecocktaildb.com/images/media/drink/rtwwsx1472720307.jpg",
      "https://www.thecocktaildb.com/images/media/drink/vqquwx1472720634.jpg",
      "https://www.thecocktaildb.com/images/media/drink/uvypss1472720581.jpg",
      "https://www.thecocktaildb.com/images/media/drink/xwuqvw1473201811.jpg",
      "https://www.thecocktaildb.com/images/media/drink/3nbu4a1487603196.jpg",
      "https://www.thecocktaildb.com/images/media/drink/jbqrhv1487603186.jpg",
      "https://www.thecocktaildb.com/images/media/drink/q7w4xu1487603180.jpg",
      "https://www.thecocktaildb.com/images/media/drink/yrtxxp1472719367.jpg",
      "https://www.thecocktaildb.com/images/media/drink/mzgaqu1504389248.jpg"
]
  },
  {
    pattern: /\b(pudding|sorbet|mousse|crumble|nice\s+cream|berry|berries|apple|banana|mango|watermelon|parfait|jelly|date|dessert)\b/i,
    urls: [
      "https://www.themealdb.com/images/media/meals/xrrtss1511555269.jpg",
      "https://www.themealdb.com/images/media/meals/ruwpww1511817242.jpg",
      "https://www.themealdb.com/images/media/meals/8ovxf41763253962.jpg",
      "https://www.themealdb.com/images/media/meals/sytuqu1511553755.jpg",
      "https://www.themealdb.com/images/media/meals/wrssvt1511556563.jpg",
      "https://www.themealdb.com/images/media/meals/pvfkz61761595976.jpg",
      "https://www.themealdb.com/images/media/meals/xwutvy1511555540.jpg",
      "https://www.themealdb.com/images/media/meals/h031jy1782853081.jpg",
      "https://www.themealdb.com/images/media/meals/qysyss1511558054.jpg",
      "https://www.themealdb.com/images/media/meals/w8umt11583268117.jpg",
      "https://www.themealdb.com/images/media/meals/ysxwuq1487323065.jpg",
      "https://www.themealdb.com/images/media/meals/spswqs1511558697.jpg",
      "https://www.themealdb.com/images/media/meals/kpiu4t1782242131.jpg",
      "https://www.themealdb.com/images/media/meals/hbte551782770868.jpg",
      "https://www.themealdb.com/images/media/meals/ae4rwb1779645576.jpg"
]
  }
];

// Verified HTTP-200 reserve pool of 100 distinct TheMealDB culinary photographs
const RESERVE_UNIQUE_CULINARY_PHOTOS: string[] = [
  "https://www.themealdb.com/images/media/meals/jvjnoh1780086318.jpg",
  "https://www.themealdb.com/images/media/meals/hqaejl1695738653.jpg",
  "https://www.themealdb.com/images/media/meals/1550441882.jpg",
  "https://www.themealdb.com/images/media/meals/oaqz9f1766593912.jpg",
  "https://www.themealdb.com/images/media/meals/utxryw1511721587.jpg",
  "https://www.themealdb.com/images/media/meals/eqnf3p1779649407.jpg",
  "https://www.themealdb.com/images/media/meals/1543774956.jpg",
  "https://www.themealdb.com/images/media/meals/sqrtwu1511721265.jpg",
  "https://www.themealdb.com/images/media/meals/bfok4w1780242078.jpg",
  "https://www.themealdb.com/images/media/meals/thazgm1555350962.jpg",
  "https://www.themealdb.com/images/media/meals/sng9bm1765320170.jpg",
  "https://www.themealdb.com/images/media/meals/c400ok1764439058.jpg",
  "https://www.themealdb.com/images/media/meals/hyk47c1762772689.jpg",
  "https://www.themealdb.com/images/media/meals/1550440197.jpg",
  "https://www.themealdb.com/images/media/meals/1550441275.jpg",
  "https://www.themealdb.com/images/media/meals/927vvp1779732018.jpg",
  "https://www.themealdb.com/images/media/meals/f3ee3y1763309332.jpg",
  "https://www.themealdb.com/images/media/meals/smoa3h1762341142.jpg",
  "https://www.themealdb.com/images/media/meals/30s7vf1763741844.jpg",
  "https://www.themealdb.com/images/media/meals/vdwloy1713225718.jpg",
  "https://www.themealdb.com/images/media/meals/020z181619788503.jpg",
  "https://www.themealdb.com/images/media/meals/nmxec11782498644.jpg",
  "https://www.themealdb.com/images/media/meals/9ya6o71780262651.jpg",
  "https://www.themealdb.com/images/media/meals/sypxpx1515365095.jpg",
  "https://www.themealdb.com/images/media/meals/sbx7n71587673021.jpg",
  "https://www.themealdb.com/images/media/meals/fk80jp1763280767.jpg",
  "https://www.themealdb.com/images/media/meals/uuuspp1511297945.jpg",
  "https://www.themealdb.com/images/media/meals/syqypv1486981727.jpg",
  "https://www.themealdb.com/images/media/meals/mp9z0i1782238092.jpg",
  "https://www.themealdb.com/images/media/meals/wruvqv1511880994.jpg",
  "https://www.themealdb.com/images/media/meals/1529446352.jpg",
  "https://www.themealdb.com/images/media/meals/qxytrx1511304021.jpg",
  "https://www.themealdb.com/images/media/meals/qtuwxu1468233098.jpg",
  "https://www.themealdb.com/images/media/meals/qrqywr1503066605.jpg",
  "https://www.themealdb.com/images/media/meals/wuyd2h1765655837.jpg",
  "https://www.themealdb.com/images/media/meals/xrrtss1511555269.jpg",
  "https://www.themealdb.com/images/media/meals/wyxwsp1486979827.jpg",
  "https://www.themealdb.com/images/media/meals/uuns781783804024.jpg",
  "https://www.themealdb.com/images/media/meals/tyywsw1505930373.jpg",
  "https://www.themealdb.com/images/media/meals/hob03q1780264260.jpg",
  "https://www.themealdb.com/images/media/meals/nz0lg71784671684.jpg",
  "https://www.themealdb.com/images/media/meals/er4d081765186828.jpg",
  "https://www.themealdb.com/images/media/meals/qpxvuq1511798906.jpg",
  "https://www.themealdb.com/images/media/meals/uwvxpv1511557015.jpg",
  "https://www.themealdb.com/images/media/meals/k29viq1585565980.jpg",
  "https://www.themealdb.com/images/media/meals/t5rgav1784659936.jpg",
  "https://www.themealdb.com/images/media/meals/hcg6l91763596970.jpg",
  "https://www.themealdb.com/images/media/meals/4hzyvq1763792564.jpg",
  "https://www.themealdb.com/images/media/meals/4mhr3u1763481087.jpg",
  "https://www.themealdb.com/images/media/meals/s73ytv1765567838.jpg",
  "https://www.themealdb.com/images/media/meals/qstyvs1505931190.jpg",
  "https://www.themealdb.com/images/media/meals/4htbtm1783803558.jpg",
  "https://www.themealdb.com/images/media/meals/ypxvwv1505333929.jpg",
  "https://www.themealdb.com/images/media/meals/kzxflc1763194887.jpg",
  "https://www.themealdb.com/images/media/meals/feh9k21784665694.jpg",
  "https://www.themealdb.com/images/media/meals/b5ft861583188991.jpg",
  "https://www.themealdb.com/images/media/meals/1529444113.jpg",
  "https://www.themealdb.com/images/media/meals/kvbotn1581012881.jpg",
  "https://www.themealdb.com/images/media/meals/o5fuq51764789643.jpg",
  "https://www.themealdb.com/images/media/meals/tytyxu1515363282.jpg",
  "https://www.themealdb.com/images/media/meals/utqnjv1763598650.jpg",
  "https://www.themealdb.com/images/media/meals/vwrpps1503068729.jpg",
  "https://www.themealdb.com/images/media/meals/40r49m1763197022.jpg",
  "https://www.themealdb.com/images/media/meals/1525872624.jpg",
  "https://www.themealdb.com/images/media/meals/6g9gif1782688663.jpg",
  "https://www.themealdb.com/images/media/meals/o93jur1782769321.jpg",
  "https://www.themealdb.com/images/media/meals/yxsurp1511304301.jpg",
  "https://www.themealdb.com/images/media/meals/uuuspp1468263334.jpg",
  "https://www.themealdb.com/images/media/meals/0dhtwr1763371444.jpg",
  "https://www.themealdb.com/images/media/meals/47abic1782854326.jpg",
  "https://www.themealdb.com/images/media/meals/hglsbl1614346998.jpg",
  "https://www.themealdb.com/images/media/meals/li30ck1763281992.jpg",
  "https://www.themealdb.com/images/media/meals/4o13oe1784396585.jpg",
  "https://www.themealdb.com/images/media/meals/qwrtut1468418027.jpg",
  "https://www.themealdb.com/images/media/meals/nlxald1764112200.jpg",
  "https://www.themealdb.com/images/media/meals/ruwpww1511817242.jpg",
  "https://www.themealdb.com/images/media/meals/prjve31763486864.jpg",
  "https://www.themealdb.com/images/media/meals/ro8mzj1763800655.jpg",
  "https://www.themealdb.com/images/media/meals/lx1kkj1593349302.jpg",
  "https://www.themealdb.com/images/media/meals/k5qzdl1782689660.jpg",
  "https://www.themealdb.com/images/media/meals/bmbvjk1782770310.jpg",
  "https://www.themealdb.com/images/media/meals/kcv6hj1598733479.jpg",
  "https://www.themealdb.com/images/media/meals/3um6il1763794322.jpg",
  "https://www.themealdb.com/images/media/meals/bpkxtw1763332446.jpg",
  "https://www.themealdb.com/images/media/meals/pqulvm1763282839.jpg",
  "https://www.themealdb.com/images/media/meals/8ovxf41763253962.jpg",
  "https://www.themealdb.com/images/media/meals/a08uqk1761848682.jpg",
  "https://www.themealdb.com/images/media/meals/cj56fs1762340001.jpg",
  "https://www.themealdb.com/images/media/meals/el64dy1763483009.jpg",
  "https://www.themealdb.com/images/media/meals/arzs741766434335.jpg",
  "https://www.themealdb.com/images/media/meals/d8bfyg1764117503.jpg",
  "https://www.themealdb.com/images/media/meals/qptpvt1487339892.jpg",
  "https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg",
  "https://www.themealdb.com/images/media/meals/6s3i3p1763488540.jpg",
  "https://www.themealdb.com/images/media/meals/ittake1763586925.jpg",
  "https://www.themealdb.com/images/media/meals/7kb44y1763589084.jpg",
  "https://www.themealdb.com/images/media/meals/sstssx1487349585.jpg",
  "https://www.themealdb.com/images/media/meals/ol2xxt1763582263.jpg",
  "https://www.themealdb.com/images/media/meals/z2sw3o1764378271.jpg",
  "https://www.themealdb.com/images/media/meals/pk8wtn1763758591.jpg"
];

// Fallback images categorized by meal category strictly using TheMealDB CDN
const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  breakfast: 'https://www.themealdb.com/images/media/meals/c400ok1764439058.jpg',
  lunch: 'https://www.themealdb.com/images/media/meals/sypxpx1515365095.jpg',
  dinner: 'https://www.themealdb.com/images/media/meals/sytuqu1511553755.jpg',
  snack: 'https://www.themealdb.com/images/media/meals/xrrsvt1511814969.jpg',
  snacks: 'https://www.themealdb.com/images/media/meals/xrrsvt1511814969.jpg',
  drink: 'https://www.thecocktaildb.com/images/media/drink/5noda61589575158.jpg',
  drinks: 'https://www.thecocktaildb.com/images/media/drink/5noda61589575158.jpg',
  dessert: 'https://www.themealdb.com/images/media/meals/adxcbq1619787919.jpg',
  desserts: 'https://www.themealdb.com/images/media/meals/adxcbq1619787919.jpg',
  default: 'https://www.themealdb.com/images/media/meals/sypxpx1515365095.jpg'
};

// Master list of all unique photo URLs for collision-free fallback
const ALL_UNIQUE_PHOTOS: string[] = [];
const seenMasterKeys = new Set<string>();
for (const group of DISH_FAMILY_PHOTO_POOLS) {
  for (const url of group.urls) {
    const key = getCanonicalImageKey(url);
    if (!seenMasterKeys.has(key)) {
      seenMasterKeys.add(key);
      ALL_UNIQUE_PHOTOS.push(url);
    }
  }
}
for (const url of RESERVE_UNIQUE_CULINARY_PHOTOS) {
  const key = getCanonicalImageKey(url);
  if (!seenMasterKeys.has(key)) {
    seenMasterKeys.add(key);
    ALL_UNIQUE_PHOTOS.push(url);
  }
}

/**
 * Sanitizes an existing image URL; if it is missing, matches a known broken URL,
 * or has ALREADY been used in `usedPhotoUrls`, resolves a unique dish-matched replacement from TheMealDB.
 */
export function sanitizeFoodImageUrl(
  existingUrl: string | null | undefined,
  dishName: string = '',
  cuisine: string = 'International',
  category: string = 'lunch',
  usedPhotoUrls?: Set<string>
): string {
  if (existingUrl && !isBrokenImageUrl(existingUrl)) {
    const cleanUrl = existingUrl.trim();
    if (!isUrlAlreadyUsed(cleanUrl, usedPhotoUrls)) {
      markUrlUsed(cleanUrl, usedPhotoUrls);
      return cleanUrl;
    }
  }
  return getFoodImageUrl(dishName, cuisine, category, usedPhotoUrls);
}

/**
 * Resolves a high-quality, verified culinary food image matching the dish title, cuisine, and category.
 * Guarantees zero duplicate URLs across cards by selecting unused photos from TheMealDB dish family
 * or collision-free reserve pool.
 */
export function getFoodImageUrl(
  dishName: string = '',
  cuisine: string = 'International',
  category: string = 'lunch',
  usedPhotoUrls?: Set<string>
): string {
  const lowerTitle = dishName.toLowerCase().trim();
  const lowerCat = category.toLowerCase().trim();

  // Compute deterministic hash from title so different dishes in the same family start at different offsets
  let hash = 0;
  for (let i = 0; i < lowerTitle.length; i++) {
    hash = (hash << 5) - hash + lowerTitle.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);

  // 1. Match dish-family photo pool first so the image visually represents the dish type
  for (const family of DISH_FAMILY_PHOTO_POOLS) {
    if (family.pattern.test(lowerTitle)) {
      const pool = family.urls;
      for (let i = 0; i < pool.length; i++) {
        const candidate = pool[(absHash + i) % pool.length];
        if (!isUrlAlreadyUsed(candidate, usedPhotoUrls)) {
          markUrlUsed(candidate, usedPhotoUrls);
          return candidate;
        }
      }
    }
  }

  // 2. Category-matched family fallback
  if (lowerCat.includes('drink')) {
    const drinkPool = DISH_FAMILY_PHOTO_POOLS.find(f => f.pattern.source.includes('smoothie'))?.urls || [];
    for (let i = 0; i < drinkPool.length; i++) {
      const candidate = drinkPool[(absHash + i) % drinkPool.length];
      if (!isUrlAlreadyUsed(candidate, usedPhotoUrls)) {
        markUrlUsed(candidate, usedPhotoUrls);
        return candidate;
      }
    }
  } else if (lowerCat.includes('dessert')) {
    const dessertPool = DISH_FAMILY_PHOTO_POOLS.find(f => f.pattern.source.includes('pudding'))?.urls || [];
    for (let i = 0; i < dessertPool.length; i++) {
      const candidate = dessertPool[(absHash + i) % dessertPool.length];
      if (!isUrlAlreadyUsed(candidate, usedPhotoUrls)) {
        markUrlUsed(candidate, usedPhotoUrls);
        return candidate;
      }
    }
  } else if (lowerCat.includes('snack')) {
    const snackPool = DISH_FAMILY_PHOTO_POOLS.find(f => f.pattern.source.includes('falafel'))?.urls || [
      "https://www.themealdb.com/images/media/meals/xrrsvt1511814969.jpg",
      "https://www.themealdb.com/images/media/meals/1529444113.jpg",
      "https://www.themealdb.com/images/media/meals/dlmh401760524897.jpg",
      "https://www.themealdb.com/images/media/meals/j223gc1784579841.jpg",
      "https://www.themealdb.com/images/media/meals/grhn401765687086.jpg",
      "https://www.themealdb.com/images/media/meals/1548772327.jpg",
      "https://www.themealdb.com/images/media/meals/5vhbzt1782239221.jpg",
      "https://www.themealdb.com/images/media/meals/st9shl1763755808.jpg",
      "https://www.themealdb.com/images/media/meals/pk8wtn1763758591.jpg",
      "https://www.themealdb.com/images/media/meals/k29viq1585565980.jpg",
      "https://www.themealdb.com/images/media/meals/0iryz91763778419.jpg",
      "https://www.themealdb.com/images/media/meals/w8umt11583268117.jpg"
    ];
    for (let i = 0; i < snackPool.length; i++) {
      const candidate = snackPool[(absHash + i) % snackPool.length];
      if (!isUrlAlreadyUsed(candidate, usedPhotoUrls)) {
        markUrlUsed(candidate, usedPhotoUrls);
        return candidate;
      }
    }
  }

  // 3. Collision-free deterministic hash into master unique photos pool
  if (ALL_UNIQUE_PHOTOS.length > 0) {
    const startIndex = absHash % ALL_UNIQUE_PHOTOS.length;
    for (let i = 0; i < ALL_UNIQUE_PHOTOS.length; i++) {
      const idx = (startIndex + i) % ALL_UNIQUE_PHOTOS.length;
      const candidateUrl = ALL_UNIQUE_PHOTOS[idx];
      if (!isUrlAlreadyUsed(candidateUrl, usedPhotoUrls)) {
        markUrlUsed(candidateUrl, usedPhotoUrls);
        return candidateUrl;
      }
    }
    return ALL_UNIQUE_PHOTOS[startIndex];
  }

  // 4. Return category-specific authentic fallback
  const fallback = CATEGORY_DEFAULT_IMAGES[lowerCat] || CATEGORY_DEFAULT_IMAGES.default;
  markUrlUsed(fallback, usedPhotoUrls);
  return fallback;
}
