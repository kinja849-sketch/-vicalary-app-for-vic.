/**
 * Indonesian Food Composition Table (TKPI / Tabel Komposisi Pangan Indonesia) Service
 *
 * Supplies validated nutritional reference records (per 100g edible portion)
 * and recipe-level component decompositions for authentic Indonesian fresh ingredients
 * and prepared meals (Kementerian Kesehatan RI — TKPI 2020 edition).
 *
 * Prevents treating Indonesian dishes as equivalent to unrelated Western foods
 * and distinguishes raw (mentah) vs cooked/boiled/fried (masak/rebus/goreng) states.
 */

export interface TKPIRecord {
  tkpi_code: string;
  name_id: string;
  name_en: string;
  aliases: string[];
  category: string;
  preparation_state: 'raw' | 'boiled' | 'steamed' | 'fried' | 'grilled' | 'stewed' | 'prepared';
  dataset_version: string;
  basis: '100g';
  calories_per_100g: number;
  energy_kj_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  default_serving_g: number;
  vitamins: string[];
  minerals: string[];
}

export interface IndonesianMealDecompositionTemplate {
  dish_name_id: string;
  dish_name_en: string;
  aliases: string[];
  components: Array<{
    name: string;
    tkpi_code: string;
    preparation_state: TKPIRecord['preparation_state'];
    observation_type: 'directly_observed' | 'inferred_ingredient';
    default_portion_g: number;
    weight_range_g: { min: number; max: number };
    notes: string;
  }>;
}

const TKPI_RECORDS: TKPIRecord[] = [
  {
    tkpi_code: 'TKPI-AP001',
    name_id: 'Nasi Putih (Masak / Kukus)',
    name_en: 'Cooked White Rice (Nasi Putih)',
    aliases: ['nasi putih', 'nasi', 'steamed white rice', 'cooked rice', 'white rice'],
    category: 'Cereals & Grains',
    preparation_state: 'steamed',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 130,
    energy_kj_per_100g: 544,
    protein_g: 2.7,
    carbs_g: 28.2,
    fat_g: 0.3,
    fiber_g: 0.4,
    sugar_g: 0.1,
    sodium_mg: 1,
    default_serving_g: 150,
    vitamins: ['Thiamin (B1)', 'Folate (B9)'],
    minerals: ['Manganese', 'Selenium']
  },
  {
    tkpi_code: 'TKPI-AP002',
    name_id: 'Beras Putih Mentah',
    name_en: 'Raw White Rice Grain',
    aliases: ['beras putih', 'beras mentah', 'raw white rice'],
    category: 'Cereals & Grains',
    preparation_state: 'raw',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 357,
    energy_kj_per_100g: 1494,
    protein_g: 8.4,
    carbs_g: 77.1,
    fat_g: 1.7,
    fiber_g: 0.8,
    sugar_g: 0.2,
    sodium_mg: 5,
    default_serving_g: 100,
    vitamins: ['Thiamin (B1)', 'Niacin (B3)'],
    minerals: ['Phosphorus', 'Potassium']
  },
  {
    tkpi_code: 'TKPI-AP005',
    name_id: 'Nasi Goreng',
    name_en: 'Indonesian Fried Rice (Nasi Goreng)',
    aliases: ['nasi goreng', 'nasgor', 'indonesian fried rice', 'fried rice'],
    category: 'Prepared Indonesian Dish',
    preparation_state: 'fried',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 168,
    energy_kj_per_100g: 703,
    protein_g: 5.0,
    carbs_g: 21.0,
    fat_g: 7.2,
    fiber_g: 1.5,
    sugar_g: 1.2,
    sodium_mg: 380,
    default_serving_g: 250,
    vitamins: ['Vitamin A', 'B Vitamins'],
    minerals: ['Iron', 'Sodium', 'Potassium']
  },
  {
    tkpi_code: 'TKPI-AP006',
    name_id: 'Nasi Uduk',
    name_en: 'Coconut Steamed Rice (Nasi Uduk)',
    aliases: ['nasi uduk', 'coconut rice', 'nasi lemak'],
    category: 'Prepared Indonesian Dish',
    preparation_state: 'steamed',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 163,
    energy_kj_per_100g: 682,
    protein_g: 3.1,
    carbs_g: 27.5,
    fat_g: 4.5,
    fiber_g: 0.8,
    sugar_g: 0.6,
    sodium_mg: 240,
    default_serving_g: 200,
    vitamins: ['Thiamin (B1)'],
    minerals: ['Potassium', 'Magnesium']
  },
  {
    tkpi_code: 'TKPI-AP010',
    name_id: 'Mie Goreng',
    name_en: 'Indonesian Fried Noodles (Mie Goreng)',
    aliases: ['mie goreng', 'mi goreng', 'bakmi goreng', 'fried noodles'],
    category: 'Prepared Indonesian Dish',
    preparation_state: 'fried',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 190,
    energy_kj_per_100g: 795,
    protein_g: 5.5,
    carbs_g: 28.0,
    fat_g: 6.5,
    fiber_g: 1.8,
    sugar_g: 2.5,
    sodium_mg: 520,
    default_serving_g: 220,
    vitamins: ['Thiamin (B1)', 'Niacin (B3)'],
    minerals: ['Iron', 'Sodium']
  },
  {
    tkpi_code: 'TKPI-DG011',
    name_id: 'Ayam Goreng',
    name_en: 'Indonesian Spiced Fried Chicken (Ayam Goreng)',
    aliases: ['ayam goreng', 'ayam penyet', 'fried chicken indonesia'],
    category: 'Poultry & Meat',
    preparation_state: 'fried',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 245,
    energy_kj_per_100g: 1025,
    protein_g: 22.0,
    carbs_g: 3.5,
    fat_g: 15.8,
    fiber_g: 0.2,
    sugar_g: 0.1,
    sodium_mg: 420,
    default_serving_g: 120,
    vitamins: ['Niacin (B3)', 'Vitamin B6'],
    minerals: ['Phosphorus', 'Iron', 'Zinc']
  },
  {
    tkpi_code: 'TKPI-DG012',
    name_id: 'Ayam Bakar',
    name_en: 'Indonesian Grilled Chicken (Ayam Bakar)',
    aliases: ['ayam bakar', 'ayam panggang'],
    category: 'Poultry & Meat',
    preparation_state: 'grilled',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 185,
    energy_kj_per_100g: 774,
    protein_g: 25.0,
    carbs_g: 4.0,
    fat_g: 7.5,
    fiber_g: 0.2,
    sugar_g: 2.5,
    sodium_mg: 390,
    default_serving_g: 120,
    vitamins: ['Vitamin B6', 'Niacin (B3)'],
    minerals: ['Potassium', 'Phosphorus', 'Iron']
  },
  {
    tkpi_code: 'TKPI-DG015',
    name_id: 'Ayam Suwir Rebus',
    name_en: 'Shredded Boiled Chicken (Ayam Suwir)',
    aliases: ['ayam suwir', 'shredded chicken', 'boiled chicken indonesia'],
    category: 'Poultry & Meat',
    preparation_state: 'boiled',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 165,
    energy_kj_per_100g: 690,
    protein_g: 31.0,
    carbs_g: 0.0,
    fat_g: 3.6,
    fiber_g: 0.0,
    sugar_g: 0.0,
    sodium_mg: 74,
    default_serving_g: 60,
    vitamins: ['Vitamin B6', 'Niacin (B3)'],
    minerals: ['Phosphorus', 'Selenium']
  },
  {
    tkpi_code: 'TKPI-DG020',
    name_id: 'Rendang Daging Sapi',
    name_en: 'Beef Rendang (Rendang Sapi)',
    aliases: ['rendang', 'rendang sapi', 'beef rendang'],
    category: 'Prepared Indonesian Dish',
    preparation_state: 'stewed',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 215,
    energy_kj_per_100g: 900,
    protein_g: 19.5,
    carbs_g: 5.2,
    fat_g: 13.0,
    fiber_g: 1.2,
    sugar_g: 1.5,
    sodium_mg: 460,
    default_serving_g: 100,
    vitamins: ['Vitamin B12', 'Iron'],
    minerals: ['Zinc', 'Selenium', 'Phosphorus']
  },
  {
    tkpi_code: 'TKPI-DG025',
    name_id: 'Sate Ayam dengan Bumbu Kacang',
    name_en: 'Chicken Satay with Peanut Sauce (Sate Ayam)',
    aliases: ['sate ayam', 'chicken satay', 'satay ayam'],
    category: 'Prepared Indonesian Dish',
    preparation_state: 'grilled',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 218,
    energy_kj_per_100g: 912,
    protein_g: 18.0,
    carbs_g: 9.5,
    fat_g: 12.2,
    fiber_g: 1.8,
    sugar_g: 4.5,
    sodium_mg: 410,
    default_serving_g: 150,
    vitamins: ['Niacin (B3)', 'Vitamin E'],
    minerals: ['Magnesium', 'Phosphorus', 'Zinc']
  },
  {
    tkpi_code: 'TKPI-DG030',
    name_id: 'Soto Ayam (Kuah & Isian)',
    name_en: 'Indonesian Chicken Soup (Soto Ayam)',
    aliases: ['soto ayam', 'soto', 'kuah soto'],
    category: 'Prepared Indonesian Dish',
    preparation_state: 'boiled',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 75,
    energy_kj_per_100g: 314,
    protein_g: 7.0,
    carbs_g: 4.5,
    fat_g: 3.2,
    fiber_g: 0.8,
    sugar_g: 0.5,
    sodium_mg: 420,
    default_serving_g: 300,
    vitamins: ['Vitamin B6', 'Vitamin C'],
    minerals: ['Sodium', 'Potassium', 'Iron']
  },
  {
    tkpi_code: 'TKPI-DG035',
    name_id: 'Bakso Sapi Kuah',
    name_en: 'Indonesian Beef Meatball Soup (Bakso Sapi)',
    aliases: ['bakso', 'bakso sapi', 'baso', 'meatball soup indonesia'],
    category: 'Prepared Indonesian Dish',
    preparation_state: 'boiled',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 120,
    energy_kj_per_100g: 502,
    protein_g: 9.0,
    carbs_g: 8.5,
    fat_g: 5.5,
    fiber_g: 0.8,
    sugar_g: 1.0,
    sodium_mg: 480,
    default_serving_g: 280,
    vitamins: ['B Vitamins', 'Iron'],
    minerals: ['Zinc', 'Phosphorus', 'Sodium']
  },
  {
    tkpi_code: 'TKPI-KC001',
    name_id: 'Tempe Kedelai Mentah',
    name_en: 'Raw Fermented Soybean Cake (Tempeh)',
    aliases: ['tempe mentah', 'raw tempeh', 'tempeh'],
    category: 'Legumes & Soy',
    preparation_state: 'raw',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 193,
    energy_kj_per_100g: 808,
    protein_g: 19.0,
    carbs_g: 9.4,
    fat_g: 10.8,
    fiber_g: 3.5,
    sugar_g: 0.8,
    sodium_mg: 9,
    default_serving_g: 50,
    vitamins: ['Riboflavin (B2)', 'Niacin (B3)', 'Vitamin B6'],
    minerals: ['Manganese', 'Phosphorus', 'Magnesium', 'Iron']
  },
  {
    tkpi_code: 'TKPI-KC002',
    name_id: 'Tempe Goreng',
    name_en: 'Fried Tempeh (Tempe Goreng)',
    aliases: ['tempe goreng', 'fried tempeh'],
    category: 'Legumes & Soy',
    preparation_state: 'fried',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 225,
    energy_kj_per_100g: 941,
    protein_g: 18.5,
    carbs_g: 12.0,
    fat_g: 12.0,
    fiber_g: 3.8,
    sugar_g: 0.8,
    sodium_mg: 150,
    default_serving_g: 60,
    vitamins: ['Vitamin B6', 'Riboflavin (B2)', 'Niacin (B3)'],
    minerals: ['Manganese', 'Phosphorus', 'Iron', 'Magnesium']
  },
  {
    tkpi_code: 'TKPI-KC005',
    name_id: 'Tahu Mentah / Kukus',
    name_en: 'Steamed / Raw Tofu (Tahu)',
    aliases: ['tahu', 'tahu putih', 'tofu'],
    category: 'Legumes & Soy',
    preparation_state: 'steamed',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 76,
    energy_kj_per_100g: 318,
    protein_g: 8.1,
    carbs_g: 1.9,
    fat_g: 4.8,
    fiber_g: 0.3,
    sugar_g: 0.5,
    sodium_mg: 7,
    default_serving_g: 80,
    vitamins: ['Thiamin (B1)', 'Riboflavin (B2)'],
    minerals: ['Calcium', 'Iron', 'Magnesium']
  },
  {
    tkpi_code: 'TKPI-KC006',
    name_id: 'Tahu Goreng',
    name_en: 'Fried Tofu (Tahu Goreng)',
    aliases: ['tahu goreng', 'fried tofu'],
    category: 'Legumes & Soy',
    preparation_state: 'fried',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 115,
    energy_kj_per_100g: 481,
    protein_g: 9.2,
    carbs_g: 3.5,
    fat_g: 7.1,
    fiber_g: 1.5,
    sugar_g: 0.5,
    sodium_mg: 120,
    default_serving_g: 75,
    vitamins: ['Thiamin (B1)', 'Riboflavin (B2)'],
    minerals: ['Calcium', 'Iron', 'Magnesium']
  },
  {
    tkpi_code: 'TKPI-TL001',
    name_id: 'Telur Ayam Ras Rebus / Mentah',
    name_en: 'Chicken Egg (Raw / Boiled)',
    aliases: ['telur rebus', 'telur ayam', 'boiled egg', 'raw egg'],
    category: 'Eggs',
    preparation_state: 'boiled',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 143,
    energy_kj_per_100g: 598,
    protein_g: 12.6,
    carbs_g: 0.7,
    fat_g: 9.5,
    fiber_g: 0.0,
    sugar_g: 0.4,
    sodium_mg: 142,
    default_serving_g: 50,
    vitamins: ['Vitamin A', 'Vitamin D', 'Vitamin B12'],
    minerals: ['Iron', 'Phosphorus', 'Selenium']
  },
  {
    tkpi_code: 'TKPI-TL002',
    name_id: 'Telur Mata Sapi / Telur Dadar Goreng',
    name_en: 'Fried Egg / Omelet (Telur Ceplok / Dadar)',
    aliases: ['telur dadar', 'telur ceplok', 'telur mata sapi', 'fried egg'],
    category: 'Eggs',
    preparation_state: 'fried',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 196,
    energy_kj_per_100g: 820,
    protein_g: 13.6,
    carbs_g: 0.8,
    fat_g: 15.0,
    fiber_g: 0.0,
    sugar_g: 0.4,
    sodium_mg: 180,
    default_serving_g: 55,
    vitamins: ['Vitamin A', 'Vitamin D', 'Vitamin B12'],
    minerals: ['Iron', 'Phosphorus', 'Choline']
  },
  {
    tkpi_code: 'TKPI-SY001',
    name_id: 'Gado-Gado (Sayuran & Bumbu Kacang)',
    name_en: 'Gado-Gado (Indonesian Vegetable Salad with Peanut Sauce)',
    aliases: ['gado-gado', 'gado gado', 'pecel sayur', 'karedok'],
    category: 'Prepared Indonesian Dish',
    preparation_state: 'prepared',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 135,
    energy_kj_per_100g: 565,
    protein_g: 5.2,
    carbs_g: 12.5,
    fat_g: 7.5,
    fiber_g: 3.2,
    sugar_g: 3.8,
    sodium_mg: 310,
    default_serving_g: 250,
    vitamins: ['Vitamin A', 'Vitamin C', 'Folate'],
    minerals: ['Potassium', 'Calcium', 'Iron']
  },
  {
    tkpi_code: 'TKPI-SY005',
    name_id: 'Sayur Asem',
    name_en: 'Indonesian Tamarind Vegetable Soup (Sayur Asem)',
    aliases: ['sayur asem', 'sayur asam'],
    category: 'Vegetables & Soups',
    preparation_state: 'boiled',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 38,
    energy_kj_per_100g: 159,
    protein_g: 1.4,
    carbs_g: 7.2,
    fat_g: 0.6,
    fiber_g: 2.1,
    sugar_g: 2.8,
    sodium_mg: 290,
    default_serving_g: 180,
    vitamins: ['Vitamin C', 'Vitamin A', 'Folate'],
    minerals: ['Potassium', 'Magnesium']
  },
  {
    tkpi_code: 'TKPI-SY008',
    name_id: 'Tumis Kangkung',
    name_en: 'Sautéed Water Spinach (Tumis Kangkung)',
    aliases: ['tumis kangkung', 'cah kangkung', 'kangkung'],
    category: 'Vegetables',
    preparation_state: 'fried',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 58,
    energy_kj_per_100g: 243,
    protein_g: 2.2,
    carbs_g: 4.0,
    fat_g: 3.8,
    fiber_g: 2.5,
    sugar_g: 1.0,
    sodium_mg: 340,
    default_serving_g: 100,
    vitamins: ['Vitamin A', 'Vitamin C', 'Iron'],
    minerals: ['Calcium', 'Potassium']
  },
  {
    tkpi_code: 'TKPI-SY010',
    name_id: 'Capcay Sayur',
    name_en: 'Stir-Fried Mixed Vegetables (Capcay)',
    aliases: ['capcay', 'cap cai', 'tumis sayur campur'],
    category: 'Vegetables',
    preparation_state: 'fried',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 65,
    energy_kj_per_100g: 272,
    protein_g: 2.8,
    carbs_g: 7.5,
    fat_g: 2.5,
    fiber_g: 2.8,
    sugar_g: 2.2,
    sodium_mg: 360,
    default_serving_g: 150,
    vitamins: ['Vitamin C', 'Vitamin K', 'Folate'],
    minerals: ['Potassium', 'Calcium']
  },
  {
    tkpi_code: 'TKPI-BM001',
    name_id: 'Sambal Terasi / Sambal Cabai',
    name_en: 'Indonesian Chili Paste (Sambal)',
    aliases: ['sambal', 'sambal terasi', 'sambal bawang', 'sambal bajak'],
    category: 'Condiments & Sauces',
    preparation_state: 'fried',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 90,
    energy_kj_per_100g: 377,
    protein_g: 1.8,
    carbs_g: 10.0,
    fat_g: 4.5,
    fiber_g: 2.8,
    sugar_g: 3.5,
    sodium_mg: 540,
    default_serving_g: 20,
    vitamins: ['Vitamin C', 'Vitamin A'],
    minerals: ['Potassium', 'Sodium']
  },
  {
    tkpi_code: 'TKPI-BM002',
    name_id: 'Minyak Goreng Sawit',
    name_en: 'Cooking Oil (Palm / Vegetable Oil)',
    aliases: ['minyak goreng', 'cooking oil', 'palm oil', 'vegetable oil', 'frying oil'],
    category: 'Fats & Oils',
    preparation_state: 'prepared',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 884,
    energy_kj_per_100g: 3699,
    protein_g: 0.0,
    carbs_g: 0.0,
    fat_g: 100.0,
    fiber_g: 0.0,
    sugar_g: 0.0,
    sodium_mg: 0,
    default_serving_g: 10,
    vitamins: ['Vitamin E'],
    minerals: []
  },
  {
    tkpi_code: 'TKPI-SN001',
    name_id: 'Kerupuk Udang / Putih Goreng',
    name_en: 'Indonesian Fried Crackers (Kerupuk)',
    aliases: ['kerupuk', 'krupuk', 'prawn crackers'],
    category: 'Snacks & Accompaniments',
    preparation_state: 'fried',
    dataset_version: 'TKPI-2020-Kemenkes-RI',
    basis: '100g',
    calories_per_100g: 480,
    energy_kj_per_100g: 2008,
    protein_g: 2.0,
    carbs_g: 68.0,
    fat_g: 22.0,
    fiber_g: 1.2,
    sugar_g: 1.5,
    sodium_mg: 620,
    default_serving_g: 20,
    vitamins: ['Vitamin E'],
    minerals: ['Sodium']
  }
];

const INDONESIAN_MEAL_TEMPLATES: IndonesianMealDecompositionTemplate[] = [
  {
    dish_name_id: 'Nasi Goreng Komplit',
    dish_name_en: 'Indonesian Fried Rice (Nasi Goreng) with Egg, Chicken & Vegetables',
    aliases: ['nasi goreng', 'nasgor', 'indonesian fried rice'],
    components: [
      {
        name: 'Cooked White Rice (Nasi Putih)',
        tkpi_code: 'TKPI-AP001',
        preparation_state: 'steamed',
        observation_type: 'directly_observed',
        default_portion_g: 180,
        weight_range_g: { min: 150, max: 220 },
        notes: 'Stir-fried rice base'
      },
      {
        name: 'Fried Egg (Telur Ceplok / Orak-Arik)',
        tkpi_code: 'TKPI-TL002',
        preparation_state: 'fried',
        observation_type: 'directly_observed',
        default_portion_g: 50,
        weight_range_g: { min: 45, max: 60 },
        notes: '1 standard egg'
      },
      {
        name: 'Shredded Chicken (Ayam Suwir)',
        tkpi_code: 'TKPI-DG015',
        preparation_state: 'boiled',
        observation_type: 'directly_observed',
        default_portion_g: 45,
        weight_range_g: { min: 30, max: 65 },
        notes: 'Diced/shredded chicken mixed in or alongside rice'
      },
      {
        name: 'Mixed Vegetables (Cucumber, Tomato & Greens)',
        tkpi_code: 'TKPI-SY010',
        preparation_state: 'fried',
        observation_type: 'directly_observed',
        default_portion_g: 50,
        weight_range_g: { min: 35, max: 70 },
        notes: 'Chopped vegetables and fresh cucumber/tomato garnish'
      },
      {
        name: 'Cooking Oil & Sweet Soy Seasoning (Minyak Goreng & Bumbu)',
        tkpi_code: 'TKPI-BM002',
        preparation_state: 'prepared',
        observation_type: 'inferred_ingredient',
        default_portion_g: 12,
        weight_range_g: { min: 8, max: 18 },
        notes: 'Inferred wok frying oil absorbed during preparation (~1 tbsp)'
      }
    ]
  },
  {
    dish_name_id: 'Ayam Penyet dengan Nasi & Sambal',
    dish_name_en: 'Smashed Fried Chicken (Ayam Penyet) with Rice, Sambal & Lalapan',
    aliases: ['ayam penyet', 'nasi ayam penyet'],
    components: [
      {
        name: 'Spiced Fried Chicken (Ayam Goreng)',
        tkpi_code: 'TKPI-DG011',
        preparation_state: 'fried',
        observation_type: 'directly_observed',
        default_portion_g: 120,
        weight_range_g: { min: 100, max: 150 },
        notes: '1 piece smashed fried chicken'
      },
      {
        name: 'Cooked White Rice (Nasi Putih)',
        tkpi_code: 'TKPI-AP001',
        preparation_state: 'steamed',
        observation_type: 'directly_observed',
        default_portion_g: 150,
        weight_range_g: { min: 130, max: 180 },
        notes: '1 standard scoop of steamed white rice'
      },
      {
        name: 'Fried Tempeh & Tofu (Tempe & Tahu Goreng)',
        tkpi_code: 'TKPI-KC002',
        preparation_state: 'fried',
        observation_type: 'directly_observed',
        default_portion_g: 50,
        weight_range_g: { min: 40, max: 70 },
        notes: '1 slice fried tempeh/tofu side'
      },
      {
        name: 'Chili Sambal Paste (Sambal Terasi)',
        tkpi_code: 'TKPI-BM001',
        preparation_state: 'fried',
        observation_type: 'directly_observed',
        default_portion_g: 25,
        weight_range_g: { min: 15, max: 35 },
        notes: 'Crushed chili sambal topping'
      }
    ]
  },
  {
    dish_name_id: 'Nasi Uduk Komplit',
    dish_name_en: 'Indonesian Coconut Rice (Nasi Uduk) with Omelet, Tempeh & Sambal',
    aliases: ['nasi uduk', 'nasi lemak'],
    components: [
      {
        name: 'Coconut Milk Steamed Rice (Nasi Uduk)',
        tkpi_code: 'TKPI-AP002',
        preparation_state: 'steamed',
        observation_type: 'directly_observed',
        default_portion_g: 170,
        weight_range_g: { min: 140, max: 200 },
        notes: 'Steamed rice cooked in coconut milk'
      },
      {
        name: 'Shredded Fried Omelet (Telur Dadar Rawis)',
        tkpi_code: 'TKPI-TL002',
        preparation_state: 'fried',
        observation_type: 'directly_observed',
        default_portion_g: 45,
        weight_range_g: { min: 35, max: 60 },
        notes: 'Sliced omelet topping'
      },
      {
        name: 'Sweet Soy Fried Tempeh (Orek Tempe)',
        tkpi_code: 'TKPI-KC002',
        preparation_state: 'fried',
        observation_type: 'directly_observed',
        default_portion_g: 50,
        weight_range_g: { min: 35, max: 65 },
        notes: 'Caramelized tempeh side'
      }
    ]
  },
  {
    dish_name_id: 'Soto Ayam Lamongan',
    dish_name_en: 'Indonesian Turmeric Chicken Soup (Soto Ayam)',
    aliases: ['soto ayam', 'soto lamongan', 'soto'],
    components: [
      {
        name: 'Soto Ayam Broth & Vermicelli (Kuah Soto & Soun)',
        tkpi_code: 'TKPI-DG030',
        preparation_state: 'boiled',
        observation_type: 'directly_observed',
        default_portion_g: 240,
        weight_range_g: { min: 200, max: 300 },
        notes: 'Aromatic turmeric broth with glass noodles and cabbage'
      },
      {
        name: 'Shredded Boiled Chicken (Ayam Suwir)',
        tkpi_code: 'TKPI-DG015',
        preparation_state: 'boiled',
        observation_type: 'directly_observed',
        default_portion_g: 65,
        weight_range_g: { min: 50, max: 85 },
        notes: 'Shredded chicken breast/thigh'
      },
      {
        name: 'Boiled Chicken Egg (Telur Rebus)',
        tkpi_code: 'TKPI-TL001',
        preparation_state: 'boiled',
        observation_type: 'directly_observed',
        default_portion_g: 50,
        weight_range_g: { min: 45, max: 55 },
        notes: '1 boiled egg'
      }
    ]
  },
  {
    dish_name_id: 'Bakso Sapi Kuah Mie',
    dish_name_en: 'Indonesian Beef Meatball Noodle Soup (Bakso Sapi)',
    aliases: ['bakso sapi', 'bakso', 'mie bakso'],
    components: [
      {
        name: 'Beef Meatballs in Broth (Bakso Sapi & Kuah)',
        tkpi_code: 'TKPI-DG035',
        preparation_state: 'boiled',
        observation_type: 'directly_observed',
        default_portion_g: 220,
        weight_range_g: { min: 180, max: 260 },
        notes: 'Beef meatballs and savory bone broth'
      },
      {
        name: 'Yellow Wheat Noodles (Mie Kuning)',
        tkpi_code: 'TKPI-AP010',
        preparation_state: 'boiled',
        observation_type: 'directly_observed',
        default_portion_g: 90,
        weight_range_g: { min: 70, max: 120 },
        notes: 'Boiled noodle portion'
      },
      {
        name: 'Steamed Tofu & Greens (Tahu & Sawi)',
        tkpi_code: 'TKPI-KC005',
        preparation_state: 'steamed',
        observation_type: 'directly_observed',
        default_portion_g: 60,
        weight_range_g: { min: 45, max: 80 },
        notes: 'Tofu and mustard greens'
      }
    ]
  },
  {
    dish_name_id: 'Mie Goreng Spesial',
    dish_name_en: 'Indonesian Stir-Fried Noodles (Mie Goreng) with Egg, Chicken & Greens',
    aliases: ['mie goreng', 'mi goreng', 'bakmi goreng', 'kwetiau goreng'],
    components: [
      {
        name: 'Stir-Fried Wheat Noodles (Mie Goreng)',
        tkpi_code: 'TKPI-AP010',
        preparation_state: 'fried',
        observation_type: 'directly_observed',
        default_portion_g: 180,
        weight_range_g: { min: 150, max: 220 },
        notes: 'Stir-fried wheat noodles'
      },
      {
        name: 'Fried Egg (Telur Orak-Arik / Ceplok)',
        tkpi_code: 'TKPI-TL002',
        preparation_state: 'fried',
        observation_type: 'directly_observed',
        default_portion_g: 50,
        weight_range_g: { min: 45, max: 60 },
        notes: '1 egg'
      },
      {
        name: 'Sauteed Mustard Greens & Cabbage (Sawi & Kol)',
        tkpi_code: 'TKPI-SY010',
        preparation_state: 'fried',
        observation_type: 'directly_observed',
        default_portion_g: 50,
        weight_range_g: { min: 35, max: 70 },
        notes: 'Stir-fried greens'
      },
      {
        name: 'Cooking Oil & Sweet Soy Seasoning (Minyak Goreng & Kecap)',
        tkpi_code: 'TKPI-BM002',
        preparation_state: 'prepared',
        observation_type: 'inferred_ingredient',
        default_portion_g: 12,
        weight_range_g: { min: 8, max: 18 },
        notes: 'Inferred wok frying oil absorbed during preparation'
      }
    ]
  }
];

export class TKPIDatasetService {
  /**
   * Searches the validated TKPI dataset by food name and optional preparation state.
   */
  static findRecord(foodName: string, preparationState?: string): TKPIRecord | null {
    if (!foodName) return null;
    const norm = foodName.toLowerCase().trim();
    const prep = (preparationState || '').toLowerCase().trim();

    // 1. Exact alias + preparation state match
    if (prep) {
      const exactWithPrep = TKPI_RECORDS.find(
        r =>
          (r.name_id.toLowerCase() === norm ||
            r.name_en.toLowerCase() === norm ||
            r.aliases.some(a => a === norm)) &&
          (r.preparation_state === prep ||
            (prep.includes('raw') && r.preparation_state === 'raw') ||
            (prep.includes('frie') && r.preparation_state === 'fried') ||
            ((prep.includes('boil') || prep.includes('steam')) &&
              (r.preparation_state === 'boiled' || r.preparation_state === 'steamed')))
      );
      if (exactWithPrep) return exactWithPrep;
    }

    // 2. Exact alias match
    const exactMatch = TKPI_RECORDS.find(
      r =>
        r.name_id.toLowerCase() === norm ||
        r.name_en.toLowerCase() === norm ||
        r.aliases.some(a => a === norm)
    );
    if (exactMatch) return exactMatch;

    // 3. Substring match on Indonesian specific terms
    const substringMatch = TKPI_RECORDS.find(r =>
      r.aliases.some(a => a.length >= 4 && (norm.includes(a) || a.includes(norm)))
    );
    return substringMatch || null;
  }

  /**
   * Alias used by NutritionNormalizer returning both flat and `per_100g` structured properties.
   */
  static lookupFood(foodName: string, preparationState?: string) {
    const rec = this.findRecord(foodName, preparationState);
    if (!rec) return null;
    return {
      ...rec,
      standard_serving_g: rec.default_serving_g,
      per_100g: {
        calories_kcal: rec.calories_per_100g,
        energy_kj: rec.energy_kj_per_100g,
        protein_g: rec.protein_g,
        carbs_g: rec.carbs_g,
        fat_g: rec.fat_g,
        fiber_g: rec.fiber_g,
        sugar_g: rec.sugar_g,
        sodium_mg: rec.sodium_mg
      }
    };
  }

  static findByCode(tkpiCode: string): TKPIRecord | null {
    return TKPI_RECORDS.find(r => r.tkpi_code === tkpiCode) || null;
  }

  /**
   * Returns a recipe-level component decomposition template for known Indonesian mixed meals
   * when an image only gives a single dish title or lacks component breakdown.
   */
  static findMealDecompositionTemplate(dishName: string): IndonesianMealDecompositionTemplate | null {
    if (!dishName) return null;
    const norm = dishName.toLowerCase().trim();
    return (
      INDONESIAN_MEAL_TEMPLATES.find(t =>
        t.aliases.some(a => norm.includes(a) || a.includes(norm))
      ) || null
    );
  }

  /**
   * Alias used by NutritionNormalizer returning component fields with both `name`/`component_name` and `default_portion_g`/`default_weight_g`.
   */
  static getMixedMealTemplate(dishName: string) {
    const tpl = this.findMealDecompositionTemplate(dishName);
    if (!tpl) return null;
    return {
      ...tpl,
      components: tpl.components.map(c => ({
        ...c,
        component_name: c.name,
        default_weight_g: c.default_portion_g,
        preparation_state: (c.preparation_state === 'prepared' ? 'cooked' : c.preparation_state) as
          | 'raw'
          | 'cooked'
          | 'fried'
          | 'boiled'
          | 'steamed'
          | 'grilled'
          | 'roasted'
          | 'stewed'
          | 'baked'
      }))
    };
  }

  static getAllRecords(): TKPIRecord[] {
    return TKPI_RECORDS;
  }
}

