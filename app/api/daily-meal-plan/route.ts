import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getFoodImageUrl } from '@/lib/services/FoodImageService';

function parsePrepTimeConstraint(prepTimeStr?: string): { maxMinutes: number; minMinutes: number; label: string } {
  if (!prepTimeStr) return { minMinutes: 10, maxMinutes: 30, label: '15-30 minutes' };
  const lower = prepTimeStr.toLowerCase();
  if (lower.includes('15') && lower.includes('30')) return { minMinutes: 15, maxMinutes: 30, label: '15-30 minutes' };
  if (lower.includes('<') || lower.includes('less') || lower.includes('kurang') || lower.includes('under 15')) return { minMinutes: 5, maxMinutes: 15, label: '< 15 minutes' };
  if (lower.includes('30') && lower.includes('60')) return { minMinutes: 30, maxMinutes: 60, label: '30-60 minutes' };
  if (lower.includes('60') || lower.includes('1h') || lower.includes('jam')) return { minMinutes: 45, maxMinutes: 75, label: '1+ hours' };
  return { minMinutes: 15, maxMinutes: 30, label: '15-30 minutes' };
}

// 12 Pre-calculated authentic culinary dishes per category
function getCuratedBasePlan(language: string = 'id', maxMinutes: number = 30) {
  const isId = language === 'id';

  return {
    breakfast: [
      { title: isId ? 'Bubur Oatmeal Ayam Suwir Kuning' : 'Savory Turmeric Chicken Oatmeal', prep_time_minutes: 5, cook_time_minutes: 10, total_calories: 360, protein_g: 28, carbs_g: 42, fat_g: 8, cuisine: 'Indonesian' },
      { title: isId ? 'Omelet Tahu Bayam Bumbu Bawang' : 'Spinach & Tofu Garlic Omelette', prep_time_minutes: 5, cook_time_minutes: 8, total_calories: 310, protein_g: 24, carbs_g: 8, fat_g: 14, cuisine: 'Asian' },
      { title: isId ? 'Nasi Merah Telur Ceplok & Lalapan' : 'Brown Rice with Sunny Egg & Fresh Greens', prep_time_minutes: 5, cook_time_minutes: 10, total_calories: 380, protein_g: 20, carbs_g: 50, fat_g: 10, cuisine: 'Indonesian' },
      { title: isId ? 'Roti Gandum Alpukat Telur Rebus' : 'Avocado Toast with Soft Boiled Eggs', prep_time_minutes: 5, cook_time_minutes: 7, total_calories: 340, protein_g: 18, carbs_g: 35, fat_g: 14, cuisine: 'Western' },
      { title: isId ? 'Smoothie Bowl Pisang Buah Naga Chia' : 'Dragon Fruit & Banana Chia Smoothie Bowl', prep_time_minutes: 8, cook_time_minutes: 0, total_calories: 290, protein_g: 10, carbs_g: 52, fat_g: 6, cuisine: 'Healthy' },
      { title: isId ? 'Scrambled Eggs Jamur Tiram & Tomat' : 'Mushroom & Tomato Scrambled Eggs', prep_time_minutes: 5, cook_time_minutes: 8, total_calories: 270, protein_g: 22, carbs_g: 6, fat_g: 16, cuisine: 'Western' },
      { title: isId ? 'Bubur Manado Sehat Tanpa Santan' : 'Healthy Indonesian Vegetable Tinutuan Porridge', prep_time_minutes: 8, cook_time_minutes: 15, total_calories: 320, protein_g: 14, carbs_g: 58, fat_g: 4, cuisine: 'Indonesian' },
      { title: isId ? 'Pancake Oatmeal Pisang Kayu Manis' : 'Cinnamon Banana Oat Pancakes', prep_time_minutes: 6, cook_time_minutes: 10, total_calories: 330, protein_g: 16, carbs_g: 54, fat_g: 6, cuisine: 'Healthy' },
      { title: isId ? 'Sandwich Dada Ayam Panggang Gandum' : 'Grilled Chicken Whole Wheat Sandwich', prep_time_minutes: 6, cook_time_minutes: 10, total_calories: 390, protein_g: 32, carbs_g: 40, fat_g: 10, cuisine: 'Western' },
      { title: isId ? 'Bihun Kuah Sayur Dada Ayam' : 'Warm Rice Noodle Soup with Chicken & Greens', prep_time_minutes: 5, cook_time_minutes: 12, total_calories: 350, protein_g: 26, carbs_g: 46, fat_g: 6, cuisine: 'Asian' },
      { title: isId ? 'Greek Yogurt Parfait Buah Segar' : 'Greek Yogurt & Fresh Berry Parfait', prep_time_minutes: 5, cook_time_minutes: 0, total_calories: 260, protein_g: 20, carbs_g: 34, fat_g: 4, cuisine: 'Healthy' },
      { title: isId ? 'Pepes Tahu Jamur Kukus Gurih' : 'Steamed Herb & Mushroom Tofu Pepes', prep_time_minutes: 8, cook_time_minutes: 12, total_calories: 220, protein_g: 18, carbs_g: 12, fat_g: 10, cuisine: 'Indonesian' }
    ],
    lunch: [
      { title: isId ? 'Nasi Merah Ayam Bakar Bumbu Rujak' : 'Grilled Chicken in Rujak Glaze with Brown Rice', prep_time_minutes: 8, cook_time_minutes: 14, total_calories: 520, protein_g: 44, carbs_g: 48, fat_g: 12, cuisine: 'Indonesian' },
      { title: isId ? 'Sate Dada Ayam Panggang Bumbu Kacang' : 'Grilled Chicken Satay with Light Peanut Sauce', prep_time_minutes: 10, cook_time_minutes: 12, total_calories: 450, protein_g: 42, carbs_g: 24, fat_g: 14, cuisine: 'Indonesian' },
      { title: isId ? 'Capcay Goreng Seafood & Tahu' : 'Wok Stir-Fried Capcay with Shrimp & Tofu', prep_time_minutes: 8, cook_time_minutes: 10, total_calories: 380, protein_g: 30, carbs_g: 32, fat_g: 12, cuisine: 'Asian' },
      { title: isId ? 'Gado-Gado Siram Bumbu Kacang Sehat' : 'Indonesian Steamed Salad with Warm Peanut Dressing', prep_time_minutes: 10, cook_time_minutes: 8, total_calories: 410, protein_g: 22, carbs_g: 46, fat_g: 16, cuisine: 'Indonesian' },
      { title: isId ? 'Ayam Teriyaki Wijen Nasi Coklat' : 'Sesame Chicken Teriyaki with Steamed Rice', prep_time_minutes: 8, cook_time_minutes: 12, total_calories: 490, protein_g: 40, carbs_g: 50, fat_g: 12, cuisine: 'Asian' },
      { title: isId ? 'Tumis Tempe Tahu Buncis Saus Tiram' : 'Stir-Fried Tempeh, Tofu & Crisp Green Beans', prep_time_minutes: 6, cook_time_minutes: 10, total_calories: 370, protein_g: 24, carbs_g: 36, fat_g: 14, cuisine: 'Indonesian' },
      { title: isId ? 'Pepes Ikan Nila Kemangi Bumbu Kuning' : 'Fragrant Steamed Tilapia with Basil in Banana Leaf', prep_time_minutes: 10, cook_time_minutes: 15, total_calories: 420, protein_g: 40, carbs_g: 14, fat_g: 12, cuisine: 'Indonesian' },
      { title: isId ? 'Soto Ayam Bening Segar Jeruk Nipis' : 'Clear Turmeric Chicken Soto Soup with Herbs', prep_time_minutes: 8, cook_time_minutes: 15, total_calories: 410, protein_g: 36, carbs_g: 38, fat_g: 10, cuisine: 'Indonesian' },
      { title: isId ? 'Tumis Kangkung Terasi Bawang Putih' : 'Wok Stir-Fried Water Spinach with Garlic', prep_time_minutes: 5, cook_time_minutes: 6, total_calories: 180, protein_g: 8, carbs_g: 16, fat_g: 8, cuisine: 'Indonesian' },
      { title: isId ? 'Ikan Tongkol Balado Rendah Minyak' : 'Spicy Indonesian Tuna with Fresh Chili Relish', prep_time_minutes: 8, cook_time_minutes: 12, total_calories: 430, protein_g: 42, carbs_g: 18, fat_g: 14, cuisine: 'Indonesian' },
      { title: isId ? 'Daging Sapi Cah Brokoli Saus Tiram' : 'Lean Beef & Broccoli Stir-Fry in Oyster Sauce', prep_time_minutes: 8, cook_time_minutes: 12, total_calories: 480, protein_g: 38, carbs_g: 28, fat_g: 16, cuisine: 'Asian' },
      { title: isId ? 'Sup Jagung Telur Dada Ayam' : 'Sweet Corn & Shredded Chicken Egg Drop Soup', prep_time_minutes: 6, cook_time_minutes: 12, total_calories: 340, protein_g: 28, carbs_g: 36, fat_g: 8, cuisine: 'Asian' }
    ],
    dinner: [
      { title: isId ? 'Sup Ikan Kakap Kuah Bening Asam Segar' : 'Fresh Indonesian Snapper Soup with Tomatoes & Lime', prep_time_minutes: 6, cook_time_minutes: 12, total_calories: 340, protein_g: 38, carbs_g: 12, fat_g: 6, cuisine: 'Indonesian' },
      { title: isId ? 'Dada Ayam Panggang Bumbu Rosemary Lemon' : 'Lemon Herb Grilled Chicken Breast', prep_time_minutes: 6, cook_time_minutes: 12, total_calories: 380, protein_g: 44, carbs_g: 8, fat_g: 10, cuisine: 'Western' },
      { title: isId ? 'Tumis Brokoli Kangkung Bawang Putih & Tahu' : 'Garlic Broccoli & Tofu Stir-Fry', prep_time_minutes: 5, cook_time_minutes: 8, total_calories: 290, protein_g: 18, carbs_g: 22, fat_g: 12, cuisine: 'Asian' },
      { title: isId ? 'Ikan Nila Bakar Madu Pedas Ringan' : 'Honey Spiced Grilled Tilapia with Lime', prep_time_minutes: 8, cook_time_minutes: 14, total_calories: 390, protein_g: 40, carbs_g: 18, fat_g: 10, cuisine: 'Indonesian' },
      { title: isId ? 'Sup Ayam Jamur Sayuran Bening' : 'Clear Chicken & Mushroom Vegetable Soup', prep_time_minutes: 6, cook_time_minutes: 12, total_calories: 310, protein_g: 32, carbs_g: 16, fat_g: 8, cuisine: 'Indonesian' },
      { title: isId ? 'Tumis Tauge Tahu Tempe Daun Bawang' : 'Stir-Fried Bean Sprouts, Tofu & Scallions', prep_time_minutes: 4, cook_time_minutes: 6, total_calories: 240, protein_g: 16, carbs_g: 18, fat_g: 10, cuisine: 'Indonesian' },
      { title: isId ? 'Steak Tempe Saus Lada Hitam' : 'Crisp Tempeh Steak with Black Pepper Glaze', prep_time_minutes: 8, cook_time_minutes: 10, total_calories: 350, protein_g: 22, carbs_g: 30, fat_g: 14, cuisine: 'Fusion' },
      { title: isId ? 'Salad Dada Ayam Panggang Saus Wijen' : 'Grilled Chicken Salad with Light Sesame Dressing', prep_time_minutes: 8, cook_time_minutes: 10, total_calories: 360, protein_g: 38, carbs_g: 14, fat_g: 12, cuisine: 'Healthy' },
      { title: isId ? 'Udang Tumis Bawang Putih Daun Ketumbar' : 'Garlic & Cilantro Sautéed Tiger Prawns', prep_time_minutes: 6, cook_time_minutes: 8, total_calories: 320, protein_g: 34, carbs_g: 8, fat_g: 10, cuisine: 'Asian' },
      { title: isId ? 'Sup Tomat Telur Serabut Lembut' : 'Silky Tomato & Egg Drop Comfort Soup', prep_time_minutes: 5, cook_time_minutes: 8, total_calories: 220, protein_g: 14, carbs_g: 16, fat_g: 10, cuisine: 'Asian' },
      { title: isId ? 'Ayam Suwir Kukus Sambal Matah Rendah Minyak' : 'Shredded Steamed Chicken with Fresh Balinese Sambal', prep_time_minutes: 8, cook_time_minutes: 10, total_calories: 370, protein_g: 42, carbs_g: 6, fat_g: 14, cuisine: 'Indonesian' },
      { title: isId ? 'Sayur Bening Bayam Jagung Manis' : 'Spinach & Sweet Corn Light Herbal Broth', prep_time_minutes: 5, cook_time_minutes: 8, total_calories: 160, protein_g: 8, carbs_g: 26, fat_g: 2, cuisine: 'Indonesian' }
    ],
    snacks: [
      { title: isId ? 'Edamame Rebus Tabur Garam Laut' : 'Steamed Sea Salt Edamame', prep_time_minutes: 2, cook_time_minutes: 6, total_calories: 140, protein_g: 12, carbs_g: 10, fat_g: 5, cuisine: 'Healthy' },
      { title: isId ? 'Pisang Panggang Madu Kayu Manis' : 'Cinnamon Honey Grilled Banana', prep_time_minutes: 3, cook_time_minutes: 6, total_calories: 160, protein_g: 2, carbs_g: 38, fat_g: 1, cuisine: 'Indonesian' },
      { title: isId ? 'Kacang Almond Panggang Tanpa Garam' : 'Roasted Unsalted Almonds', prep_time_minutes: 1, cook_time_minutes: 5, total_calories: 170, protein_g: 6, carbs_g: 6, fat_g: 15, cuisine: 'Healthy' },
      { title: isId ? 'Rujak Buah Segar Bumbu Kacang Ringan' : 'Fresh Tropical Fruit Salad with Light Dressing', prep_time_minutes: 8, cook_time_minutes: 0, total_calories: 150, protein_g: 3, carbs_g: 36, fat_g: 2, cuisine: 'Indonesian' },
      { title: isId ? 'Lumpia Basah Sayur Saus Tauco' : 'Fresh Vegetable Summer Rolls', prep_time_minutes: 10, cook_time_minutes: 5, total_calories: 160, protein_g: 6, carbs_g: 28, fat_g: 3, cuisine: 'Indonesian' },
      { title: isId ? 'Kacang Hijau Rebus Gula Aren Jahe' : 'Warm Ginger & Mung Bean Snack', prep_time_minutes: 5, cook_time_minutes: 12, total_calories: 180, protein_g: 8, carbs_g: 34, fat_g: 1, cuisine: 'Indonesian' },
      { title: isId ? 'Singkong Rebus Tabur Kelapa Parut' : 'Steamed Cassava with Fresh Grated Coconut', prep_time_minutes: 5, cook_time_minutes: 12, total_calories: 190, protein_g: 2, carbs_g: 42, fat_g: 2, cuisine: 'Indonesian' },
      { title: isId ? 'Ubi Cilembu Panggang Manis Alami' : 'Roasted Sweet Potato with Natural Honey Glaze', prep_time_minutes: 3, cook_time_minutes: 15, total_calories: 180, protein_g: 3, carbs_g: 42, fat_g: 1, cuisine: 'Indonesian' },
      { title: isId ? 'Keripik Tempe Panggang Oven' : 'Oven-Baked Crisp Tempeh Chips', prep_time_minutes: 5, cook_time_minutes: 12, total_calories: 160, protein_g: 10, carbs_g: 12, fat_g: 8, cuisine: 'Indonesian' },
      { title: isId ? 'Potongan Buah Semangka & Melon Dingin' : 'Chilled Watermelon & Honeydew Slices', prep_time_minutes: 5, cook_time_minutes: 0, total_calories: 90, protein_g: 2, carbs_g: 22, fat_g: 0, cuisine: 'Fruit' },
      { title: isId ? 'Tahu Kukus Isi Sayuran Renyah' : 'Steamed Tofu Stuffed with Julienned Vegetables', prep_time_minutes: 6, cook_time_minutes: 8, total_calories: 140, protein_g: 12, carbs_g: 10, fat_g: 5, cuisine: 'Indonesian' },
      { title: isId ? 'Telur Puyuh Rebus & Timun Segar' : 'Hard-Boiled Quail Eggs & Crisp Cucumber', prep_time_minutes: 4, cook_time_minutes: 6, total_calories: 130, protein_g: 10, carbs_g: 4, fat_g: 8, cuisine: 'Healthy' }
    ],
    drinks: [
      { title: isId ? 'Wedang Jahe Lemon Madu Hangat' : 'Warm Ginger Honey Lemon Infusion', prep_time_minutes: 4, cook_time_minutes: 6, total_calories: 65, protein_g: 1, carbs_g: 16, fat_g: 0, cuisine: 'Beverage' },
      { title: isId ? 'Es Teh Hijau Lemon Selasih' : 'Iced Green Tea with Lemon & Basil Seeds', prep_time_minutes: 4, cook_time_minutes: 0, total_calories: 35, protein_g: 0, carbs_g: 8, fat_g: 0, cuisine: 'Beverage' },
      { title: isId ? 'Jus Mangga Segar Tanpa Gula Tambahan' : 'Pure Fresh Mango Nectar Smoothie', prep_time_minutes: 5, cook_time_minutes: 0, total_calories: 110, protein_g: 1, carbs_g: 26, fat_g: 0, cuisine: 'Beverage' },
      { title: isId ? 'Kunyit Asam Segar Tradisional' : 'Traditional Turmeric Tamarind Herbal Drink', prep_time_minutes: 5, cook_time_minutes: 8, total_calories: 55, protein_g: 1, carbs_g: 14, fat_g: 0, cuisine: 'Beverage' },
      { title: isId ? 'Infused Water Lemon Mentimun Mint' : 'Lemon, Cucumber & Fresh Mint Infused Water', prep_time_minutes: 4, cook_time_minutes: 0, total_calories: 15, protein_g: 0, carbs_g: 4, fat_g: 0, cuisine: 'Beverage' },
      { title: isId ? 'Jus Alpukat Susu Almond Rendah Kalori' : 'Avocado Almond Milk Silk Shake', prep_time_minutes: 5, cook_time_minutes: 0, total_calories: 170, protein_g: 4, carbs_g: 14, fat_g: 12, cuisine: 'Beverage' },
      { title: isId ? 'Es Kelapa Muda Jeruk Nipis Murni' : 'Pure Coconut Water with Fresh Lime', prep_time_minutes: 3, cook_time_minutes: 0, total_calories: 60, protein_g: 1, carbs_g: 14, fat_g: 0, cuisine: 'Beverage' },
      { title: isId ? 'Teh Serai Wangi Pandan Hangat' : 'Warm Lemongrass & Pandan Aromatic Tea', prep_time_minutes: 4, cook_time_minutes: 5, total_calories: 25, protein_g: 0, carbs_g: 6, fat_g: 0, cuisine: 'Beverage' },
      { title: isId ? 'Jus Buah Naga Pisang Energi Booster' : 'Dragon Fruit Banana Energy Smoothie', prep_time_minutes: 5, cook_time_minutes: 0, total_calories: 130, protein_g: 3, carbs_g: 30, fat_g: 1, cuisine: 'Beverage' },
      { title: isId ? 'Susu Kedelai Hangat Madu Murni' : 'Warm Soy Milk with Pure Blossom Honey', prep_time_minutes: 3, cook_time_minutes: 5, total_calories: 120, protein_g: 8, carbs_g: 14, fat_g: 4, cuisine: 'Beverage' },
      { title: isId ? 'Jus Tomat Apel Segar Detox' : 'Fresh Tomato & Crisp Apple Cleanse Juice', prep_time_minutes: 5, cook_time_minutes: 0, total_calories: 80, protein_g: 2, carbs_g: 18, fat_g: 0, cuisine: 'Beverage' },
      { title: isId ? 'Matcha Latte Dingin Susu Oat' : 'Iced Matcha Green Tea Oat Milk Latte', prep_time_minutes: 4, cook_time_minutes: 0, total_calories: 95, protein_g: 3, carbs_g: 16, fat_g: 2, cuisine: 'Beverage' }
    ],
    desserts: [
      { title: isId ? 'Puding Chia Santan Ringan Buah Naga' : 'Dragon Fruit Light Chia Seed Pudding', prep_time_minutes: 5, cook_time_minutes: 0, total_calories: 175, protein_g: 5, carbs_g: 22, fat_g: 6, cuisine: 'Dessert' },
      { title: isId ? 'Vanilla Bean Panna Cotta Berry Compote' : 'Vanilla Bean Panna Cotta with Berry Compote', prep_time_minutes: 8, cook_time_minutes: 5, total_calories: 220, protein_g: 4, carbs_g: 28, fat_g: 8, cuisine: 'Dessert' },
      { title: isId ? 'Puding Kelapa Muda Daun Pandan' : 'Silky Pandan Coconut Water Jelly Pudding', prep_time_minutes: 6, cook_time_minutes: 6, total_calories: 140, protein_g: 2, carbs_g: 28, fat_g: 2, cuisine: 'Dessert' },
      { title: isId ? 'Bola Ubi Ungu Kukus Isi Coklat Hitam' : 'Steamed Purple Sweet Potato Dark Chocolate Bites', prep_time_minutes: 8, cook_time_minutes: 10, total_calories: 180, protein_g: 3, carbs_g: 34, fat_g: 4, cuisine: 'Dessert' },
      { title: isId ? 'Parfait Yogurt Yunani Madu & Granola' : 'Greek Yogurt, Honey & Almond Parfait', prep_time_minutes: 5, cook_time_minutes: 0, total_calories: 210, protein_g: 14, carbs_g: 28, fat_g: 4, cuisine: 'Dessert' },
      { title: isId ? 'Sorbet Mangga Jeruk Segar Tanpa Gula' : 'Pure Mango Citrus Frozen Sorbet', prep_time_minutes: 6, cook_time_minutes: 0, total_calories: 120, protein_g: 1, carbs_g: 30, fat_g: 0, cuisine: 'Dessert' },
      { title: isId ? 'Pisang Bakar Coklat Hitam & Keju Ringan' : 'Grilled Banana with Dark Chocolate & Light Cheese', prep_time_minutes: 5, cook_time_minutes: 6, total_calories: 190, protein_g: 4, carbs_g: 36, fat_g: 4, cuisine: 'Indonesian' },
      { title: isId ? 'Puding Coklat Hitam Susu Almond' : 'Dark Chocolate Almond Milk Pudding', prep_time_minutes: 6, cook_time_minutes: 6, total_calories: 160, protein_g: 4, carbs_g: 24, fat_g: 6, cuisine: 'Dessert' },
      { title: isId ? 'Es Krim Pisang Beku Madu (Nice Cream)' : '1-Ingredient Frozen Banana Honey Nice Cream', prep_time_minutes: 4, cook_time_minutes: 0, total_calories: 130, protein_g: 2, carbs_g: 32, fat_g: 0, cuisine: 'Dessert' },
      { title: isId ? 'Kolak Pisang Labu Kuning Tanpa Santan' : 'Healthy Pumpkin & Banana Cinnamon Compote', prep_time_minutes: 8, cook_time_minutes: 12, total_calories: 190, protein_g: 3, carbs_g: 42, fat_g: 1, cuisine: 'Indonesian' },
      { title: isId ? 'Agar-Agar Buah Naga & Leci Segar' : 'Dragon Fruit & Lychee Clear Fruit Agar Jelly', prep_time_minutes: 6, cook_time_minutes: 6, total_calories: 110, protein_g: 1, carbs_g: 26, fat_g: 0, cuisine: 'Dessert' },
      { title: isId ? 'Mousse Alpukat Coklat Hitam Rendah Kalori' : 'Dark Cacao & Whipped Avocado Velvet Mousse', prep_time_minutes: 6, cook_time_minutes: 0, total_calories: 170, protein_g: 3, carbs_g: 18, fat_g: 10, cuisine: 'Dessert' }
    ]
  };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await req.json();
    const { userId, locationContext, forceRefresh } = body;

    // 1. Retrieve user profile, onboarding responses, and settings
    let onboardingData: any = null;
    let userProfile: any = null;
    let userSettings: any = null;

    if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      const [onbRes, profRes, setRes] = await Promise.all([
        supabase.from('onboarding_responses').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
      ]);
      onboardingData = onbRes.data;
      userProfile = profRes.data;
      userSettings = setRes.data;
    }

    // Determine location and language context
    const countryName = locationContext?.country_name || userProfile?.location_metadata?.country || 'Indonesia';
    const cityName = locationContext?.city || userProfile?.location_metadata?.city || 'Jakarta';
    const language = userSettings?.language || 'id';

    const rawCuisines = onboardingData?.preferred_cuisines;
    const preferredCuisines = Array.isArray(rawCuisines) && rawCuisines.length > 0
      ? rawCuisines.join(', ')
      : (countryName.toLowerCase().includes('indo') ? 'Indonesian, Asian' : 'Local Traditional, Mediterranean');

    const dietaryLifestyle = Array.isArray(onboardingData?.dietary_lifestyle) && onboardingData.dietary_lifestyle.length > 0
      ? onboardingData.dietary_lifestyle.join(', ')
      : 'Halal, Balanced';

    const dietaryPreference = onboardingData?.dietary_preference || 'Balanced';
    const restrictions = Array.isArray(onboardingData?.restrictions) ? onboardingData.restrictions.join(', ') : (onboardingData?.restrictions || 'None');
    const allergies = onboardingData?.allergies || 'None';
    const goal = onboardingData?.goal || userProfile?.goal || 'Healthy Living & Energy';
    const calorieGoal = onboardingData?.daily_calorie_goal || userProfile?.goal_calories || 2000;
    const { maxMinutes, label: prepLabel } = parsePrepTimeConstraint(onboardingData?.meal_prep_time);

    // 2. Base Curated 12-Item Plan per Category
    let planData = getCuratedBasePlan(language, maxMinutes);

    // 3. Transform and Auto-Cache every generated recipe into `cached_recipes` & `recipes`
    const categories = ['breakfast', 'lunch', 'dinner', 'snacks', 'drinks', 'desserts'];
    const responsePayload: Record<string, any[]> = {};
    const recipesToUpsert: any[] = [];
    const nowStamp = Date.now().toString(36);

    for (const cat of categories) {
      const rawList = (planData as any)[cat] || [];
      const transformedList = rawList.map((item: any, idx: number) => {
        const dishTitle = item.title || item.name || 'Delicious Meal';
        const dishCuisine = item.cuisine || preferredCuisines;
        const recipeId = item.id || `recipe_ai_${cat}_${idx + 1}_${nowStamp}`;
        
        // Exact verified culinary photography resolution
        const dishImage = getFoodImageUrl(dishTitle, dishCuisine, cat);
        
        const totalCals = item.total_calories || item.calories || 350;
        const prepTime = item.prep_time_minutes || 6;
        const cookTime = Math.min(item.cook_time_minutes || 10, Math.max(0, maxMinutes - prepTime));

        const ingredientsList = item.ingredients || [
          { item: 'Bahan segar pilihan', amount: '1', unit: 'porsi' },
          { item: 'Bumbu rempah alami', amount: '1', unit: 'sdm' },
          { item: 'Minyak kelapa sehat', amount: '1', unit: 'sdt' }
        ];

        const instructionsList = item.instructions || [
          'Siapkan dan cuci bersih semua bahan segar.',
          'Tumis atau olah bumbu rempah hingga harum pada wajan anti lengket.',
          'Masak bahan utama dengan api sedang hingga matang sempurna dan bumbu meresap.',
          'Angkat dan sajikan hangat dalam piring saji.'
        ];

        const dbRecord = {
          id: recipeId,
          title: dishTitle,
          image_url: dishImage,
          ingredients: ingredientsList,
          instructions_steps: instructionsList,
          nutrition: {
            calories: totalCals,
            protein: item.protein_g || 20,
            carbs: item.carbs_g || 30,
            fat: item.fat_g || 10
          },
          cuisine_region: dishCuisine,
          preparation_time: prepTime,
          cook_time_minutes: cookTime,
          meal_type: cat.charAt(0).toUpperCase() + cat.slice(1),
          provider: 'ai-chef'
        };

        recipesToUpsert.push(dbRecord);

        return {
          id: recipeId,
          title: dishTitle,
          name: dishTitle,
          image: dishImage,
          image_url: dishImage,
          calories: totalCals,
          total_calories: totalCals,
          subtitle: `${totalCals} kcal`,
          readyInMinutes: prepTime + cookTime,
          prep_time_minutes: prepTime,
          cook_time_minutes: cookTime,
          protein: item.protein_g || 20,
          carbs: item.carbs_g || 30,
          fat: item.fat_g || 10,
          ingredients: ingredientsList,
          instructions: instructionsList
        };
      });

      responsePayload[cat] = transformedList;
    }

    // Persist to recipes & cached_recipes tables in database
    if (recipesToUpsert.length > 0) {
      try {
        const mappedForRecipesTable = recipesToUpsert.map(r => ({
          external_id: r.id,
          title: r.title,
          image_url: r.image_url,
          ingredients: r.ingredients,
          instructions: r.instructions_steps,
          total_calories: r.nutrition?.calories || 350,
          protein_g: r.nutrition?.protein || 0,
          carbs_g: r.nutrition?.carbs || 0,
          fat_g: r.nutrition?.fat || 0,
          prep_time_minutes: r.preparation_time,
          cook_time_minutes: r.cook_time_minutes,
          cuisine_type: r.cuisine_region,
          provider: 'ai-chef'
        }));

        await Promise.allSettled([
          (supabase as any).from('recipes').upsert(mappedForRecipesTable, { onConflict: 'external_id' }),
          (supabase as any).from('cached_recipes').upsert(recipesToUpsert, { onConflict: 'id' })
        ]);
      } catch (upsertErr) {
        console.warn('[daily-meal-plan] Could not cache generated recipes in tables:', upsertErr);
      }
    }

    return NextResponse.json(responsePayload);

  } catch (error: any) {
    console.error('daily-meal-plan Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate meal plan' }, { status: 500 });
  }
}
