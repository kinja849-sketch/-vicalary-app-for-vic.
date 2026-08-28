/**
 * Comprehensive Allergen Dictionary
 * Maps root allergen classifications to detailed derivative ingredients and culinary synonyms.
 */
export const ALLERGEN_DICTIONARY: Record<string, string[]> = {
  egg: [
    'egg', 'eggs', 'whole egg', 'egg white', 'egg yolk', 'mayonnaise', 'aioli',
    'meringue', 'albumen', 'ovalbumin', 'surimi', 'lysozyme', 'telur', 'telur ayam',
    'telur bebek', 'telur puyuh', 'mayones', 'telur ceplok', 'telur dadar'
  ],
  seafood: [
    'fish', 'salmon', 'tuna', 'cod', 'tilapia', 'snapper', 'trout', 'halibut', 'mackerel',
    'anchovy', 'sardine', 'shrimp', 'prawn', 'crab', 'lobster', 'crayfish', 'squid',
    'calamari', 'octopus', 'cuttlefish', 'clam', 'mussel', 'oyster', 'scallop', 'shellfish',
    'fish sauce', 'oyster sauce', 'worcestershire', 'dashi', 'bonito', 'fish stock',
    'seafood stock', 'shrimp paste', 'terasi', 'belacan', 'petis', 'ikan', 'udang',
    'cumi', 'kepiting', 'kerang', 'tongkol', 'lele', 'gurame', 'bawal', 'kakap'
  ],
  fish: [
    'fish', 'salmon', 'tuna', 'cod', 'tilapia', 'snapper', 'trout', 'halibut', 'mackerel',
    'anchovy', 'sardine', 'fish sauce', 'dashi', 'bonito', 'fish stock', 'ikan', 'tongkol',
    'lele', 'gurame', 'bawal', 'kakap'
  ],
  shellfish: [
    'shrimp', 'prawn', 'crab', 'lobster', 'crayfish', 'squid', 'calamari', 'octopus',
    'clam', 'mussel', 'oyster', 'scallop', 'oyster sauce', 'shrimp paste', 'terasi',
    'belacan', 'petis', 'udang', 'cumi', 'kepiting', 'kerang'
  ],
  dairy: [
    'milk', 'cheese', 'butter', 'cream', 'heavy cream', 'sour cream', 'yogurt', 'whey',
    'casein', 'ghee', 'custard', 'parmesan', 'cheddar', 'mozzarella', 'paneer', 'ricotta',
    'susu', 'keju', 'mentega', 'krim', 'yogurt'
  ],
  peanuts: [
    'peanut', 'peanuts', 'peanut butter', 'peanut oil', 'arachis oil', 'groundnut',
    'kacang tanah', 'saus kacang', 'bumbu kacang'
  ],
  tree_nuts: [
    'almond', 'walnut', 'cashew', 'pecan', 'pistachio', 'macadamia', 'hazelnut', 'brazil nut',
    'chestnut', 'praline', 'marzipan', 'kacang mete', 'kacang almond', 'kacang walnut'
  ],
  nuts: [
    'peanut', 'peanuts', 'peanut butter', 'groundnut', 'almond', 'walnut', 'cashew',
    'pecan', 'pistachio', 'macadamia', 'hazelnut', 'kacang tanah', 'kacang mete', 'bumbu kacang'
  ],
  gluten: [
    'wheat', 'barley', 'rye', 'spelt', 'flour', 'all-purpose flour', 'wheat flour',
    'bread flour', 'semolina', 'couscous', 'seitan', 'terigu', 'tepung terigu', 'gandum', 'roti'
  ],
  wheat: [
    'wheat', 'wheat flour', 'all-purpose flour', 'bread flour', 'semolina', 'couscous',
    'terigu', 'tepung terigu', 'gandum'
  ],
  soy: [
    'soy', 'soya', 'soybean', 'soy sauce', 'tofu', 'tempeh', 'edamame', 'miso', 'tamari',
    'kecap manis', 'kecap asin', 'tahu', 'tempe', 'kedelai'
  ],
  pork: [
    'pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'lard', 'pork belly', 'pork chop',
    'sausage', 'pepperoni', 'chorizo', 'babi', 'daging babi', 'bacon babi'
  ]
};
