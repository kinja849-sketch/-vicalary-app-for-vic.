/**
 * Comprehensive Allergen Dictionary
 * Maps root allergen classifications to detailed derivative ingredients and culinary synonyms.
 */
export const ALLERGEN_DICTIONARY: Record<string, string[]> = {
  egg: [
    'egg', 'eggs', 'whole egg', 'egg white', 'egg whites', 'egg yolk', 'egg yolks',
    'mayonnaise', 'mayo', 'aioli', 'meringue', 'albumen', 'ovalbumin', 'surimi',
    'lysozyme', 'telur', 'telur ayam', 'telur bebek', 'telur puyuh', 'mayones',
    'telur ceplok', 'telur dadar'
  ],
  seafood: [
    'fish', 'salmon', 'tuna', 'cod', 'tilapia', 'snapper', 'trout', 'halibut', 'mackerel',
    'herring', 'herrings', 'sledz', 'haddock', 'pollock', 'sea bass', 'catfish', 'carp',
    'kipper', 'basa', 'flounder', 'sole', 'plaice', 'grouper', 'whitebait',
    'anchovy', 'anchovies', 'sardine', 'sardines', 'shrimp', 'prawns', 'prawn', 'crab',
    'lobster', 'crayfish', 'crawfish', 'squid', 'calamari', 'octopus', 'cuttlefish',
    'clam', 'clams', 'mussel', 'mussels', 'oyster', 'oysters', 'scallop', 'scallops',
    'shellfish', 'seafood', 'fish sauce', 'oyster sauce', 'worcestershire', 'dashi',
    'bonito', 'fish stock', 'seafood stock', 'shrimp paste', 'terasi', 'belacan',
    'petis', 'ikan', 'udang', 'cumi', 'kepiting', 'kerang', 'tongkol', 'lele', 'gurame',
    'bawal', 'kakap', 'teri'
  ],
  fish: [
    'fish', 'salmon', 'tuna', 'cod', 'tilapia', 'snapper', 'trout', 'halibut', 'mackerel',
    'herring', 'herrings', 'sledz', 'haddock', 'pollock', 'sea bass', 'catfish', 'carp',
    'kipper', 'basa', 'flounder', 'sole', 'plaice', 'grouper', 'whitebait',
    'anchovy', 'anchovies', 'sardine', 'sardines', 'fish sauce', 'dashi', 'bonito',
    'fish stock', 'ikan', 'tongkol', 'lele', 'gurame', 'bawal', 'kakap', 'teri'
  ],
  shellfish: [
    'shrimp', 'prawn', 'prawns', 'crab', 'lobster', 'crayfish', 'crawfish', 'squid',
    'calamari', 'octopus', 'cuttlefish', 'clam', 'clams', 'mussel', 'mussels', 'oyster',
    'oysters', 'scallop', 'scallops', 'shellfish', 'oyster sauce', 'shrimp paste',
    'terasi', 'belacan', 'petis', 'udang', 'cumi', 'kepiting', 'kerang'
  ],
  dairy: [
    'milk', 'whole milk', 'skim milk', 'cow milk', 'cheese', 'cream cheese', 'cottage cheese',
    'butter', 'cream', 'heavy cream', 'sour cream', 'whipping cream', 'yogurt', 'greek yogurt',
    'whey', 'casein', 'ghee', 'custard', 'parmesan', 'cheddar', 'mozzarella', 'paneer',
    'ricotta', 'feta', 'halloumi', 'brie', 'gouda', 'mascarpone', 'rommegrot', 'rømmegrøt',
    'susu', 'susu sapi', 'keju', 'mentega', 'krim', 'buttermilk', 'condensed milk', 'evaporated milk'
  ],
  cheese: [
    'cheese', 'cream cheese', 'cottage cheese', 'parmesan', 'cheddar', 'mozzarella',
    'paneer', 'ricotta', 'feta', 'halloumi', 'brie', 'gouda', 'mascarpone', 'swiss cheese',
    'provolone', 'goat cheese', 'blue cheese', 'keju', 'sour cream', 'heavy cream',
    'rommegrot', 'rømmegrøt'
  ],
  lactose: [
    'milk', 'whole milk', 'skim milk', 'cow milk', 'cheese', 'cream cheese', 'cottage cheese',
    'butter', 'cream', 'heavy cream', 'sour cream', 'whipping cream', 'yogurt', 'greek yogurt',
    'whey', 'casein', 'custard', 'parmesan', 'cheddar', 'mozzarella', 'paneer', 'ricotta',
    'feta', 'halloumi', 'brie', 'gouda', 'mascarpone', 'rommegrot', 'rømmegrøt', 'susu',
    'keju', 'mentega', 'krim', 'buttermilk', 'condensed milk', 'evaporated milk'
  ],
  peanuts: [
    'peanut', 'peanuts', 'peanut butter', 'peanut oil', 'arachis oil', 'groundnut',
    'groundnuts', 'satay sauce', 'kacang tanah', 'saus kacang', 'bumbu kacang'
  ],
  tree_nuts: [
    'almond', 'almonds', 'walnut', 'walnuts', 'cashew', 'cashews', 'pecan', 'pecans',
    'pistachio', 'pistachios', 'macadamia', 'hazelnut', 'hazelnuts', 'brazil nut',
    'chestnut', 'pine nut', 'pine nuts', 'praline', 'marzipan', 'nutella',
    'kacang mete', 'kacang almond', 'kacang walnut', 'kenari'
  ],
  nuts: [
    'peanut', 'peanuts', 'peanut butter', 'groundnut', 'almond', 'almonds', 'walnut',
    'walnuts', 'cashew', 'cashews', 'pecan', 'pecans', 'pistachio', 'pistachios',
    'macadamia', 'hazelnut', 'hazelnuts', 'pine nut', 'pine nuts', 'kacang tanah',
    'kacang mete', 'bumbu kacang', 'saus kacang'
  ],
  gluten: [
    'wheat', 'barley', 'rye', 'spelt', 'flour', 'all-purpose flour', 'wheat flour',
    'bread flour', 'semolina', 'couscous', 'bulgur', 'seitan', 'pasta', 'spaghetti',
    'macaroni', 'noodles', 'egg noodles', 'bread', 'pita', 'tortilla', 'brioche',
    'croissant', 'pastry', 'pastries', 'breadcrumbs', 'panko', 'terigu', 'tepung terigu',
    'gandum', 'roti', 'mie'
  ],
  wheat: [
    'wheat', 'wheat flour', 'all-purpose flour', 'bread flour', 'semolina', 'couscous',
    'bulgur', 'pasta', 'spaghetti', 'bread', 'pita', 'tortilla', 'breadcrumbs', 'panko',
    'terigu', 'tepung terigu', 'gandum', 'roti'
  ],
  soy: [
    'soy', 'soya', 'soybean', 'soybeans', 'soy sauce', 'soy milk', 'tofu', 'tempeh',
    'edamame', 'miso', 'tamari', 'teriyaki', 'kecap manis', 'kecap asin', 'tahu',
    'tempe', 'kedelai', 'susu kedelai'
  ],
  pork: [
    'pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'lard', 'pork belly', 'pork chop',
    'sausage', 'pepperoni', 'chorizo', 'salami', 'gammon', 'babi', 'daging babi', 'bacon babi'
  ],
  sesame: [
    'sesame', 'sesame seeds', 'sesame oil', 'tahini', 'halva', 'wijen', 'minyak wijen'
  ]
};
