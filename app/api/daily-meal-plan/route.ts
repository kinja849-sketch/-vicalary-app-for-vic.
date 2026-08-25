import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

const EDAMAM_APP_ID = process.env.EDAMAM_APP_ID;
const EDAMAM_APP_KEY = process.env.EDAMAM_APP_KEY;

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await req.json();
    const { userId, locationContext, localHour } = body;

    let dietaryLabels: string[] = [];
    
    if (userId) {
      const { data: onboarding } = await supabase
        .from('onboarding_responses')
        .select('dietary_lifestyle, goal, restrictions, allergies, health_conditions')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (onboarding) {
          const diets = Array.isArray(onboarding.dietary_lifestyle) ? onboarding.dietary_lifestyle : [];
          const restricts = Array.isArray(onboarding.restrictions) ? onboarding.restrictions : [];
          const allergies = Array.isArray(onboarding.allergies) ? onboarding.allergies : [];
          
          const allConstraints = [...diets, ...restricts, ...allergies].map(v => v.toLowerCase());

          // Map onboarding to Edamam health labels
          if (allConstraints.some(c => c.includes('vegan'))) dietaryLabels.push('vegan');
          if (allConstraints.some(c => c.includes('vegetarian'))) dietaryLabels.push('vegetarian');
          if (allConstraints.some(c => c.includes('gluten-free') || c.includes('celiac'))) dietaryLabels.push('gluten-free');
          if (allConstraints.some(c => c.includes('halal'))) dietaryLabels.push('pork-free', 'alcohol-free');
          if (allConstraints.some(c => c.includes('keto'))) dietaryLabels.push('keto-friendly');
          if (allConstraints.some(c => c.includes('peanut'))) dietaryLabels.push('peanut-free');
          if (allConstraints.some(c => c.includes('dairy'))) dietaryLabels.push('dairy-free');
          if (allConstraints.some(c => c.includes('paleo'))) dietaryLabels.push('paleo');
      }
    }

    // Map IP Location to Edamam Cuisine Type
    let cuisineType = 'world';
    const country = locationContext?.country_name || '';
    if (country.includes('Indonesia') || country.includes('Malaysia')) cuisineType = 'south east asian';
    else if (country.includes('Arab') || country.includes('Emirates')) cuisineType = 'middle eastern';
    else if (country.includes('States') || country.includes('Canada')) cuisineType = 'american';
    else if (country.includes('Kingdom')) cuisineType = 'british';
    else if (country.includes('India')) cuisineType = 'indian';
    else if (country.includes('China')) cuisineType = 'chinese';

    const fetchEdamam = async (mealType: string, customCuisine?: string) => {
        try {
            const url = new URL('https://api.edamam.com/api/recipes/v2');
            url.searchParams.append('type', 'public');
            url.searchParams.append('app_id', EDAMAM_APP_ID || '');
            url.searchParams.append('app_key', EDAMAM_APP_KEY || '');
            url.searchParams.append('mealType', mealType);
            url.searchParams.append('cuisineType', customCuisine || cuisineType);
            url.searchParams.append('random', 'true');
            
            dietaryLabels.forEach(label => url.searchParams.append('health', label));
            
            const res = await fetch(url.toString());
            if (!res.ok) return [];
            
            const data = await res.json();
            return (data.hits || []).slice(0, 6).map((hit: any) => {
                const r = hit.recipe;
                return {
                    id: r.uri.split('_')[1] || Math.random().toString(36).substring(7),
                    title: r.label,
                    image: r.image,
                    calories: Math.round(r.calories / (r.yield || 1)),
                    readyInMinutes: r.totalTime || 30
                };
            });
        } catch (e) {
            console.error('Edamam fetch error:', e);
            return [];
        }
    };

    // Parallel fetch for hyper-fast response
    let [breakfast, lunch, dinner, snacks, drinks, desserts] = await Promise.all([
        fetchEdamam('Breakfast'),
        fetchEdamam('Lunch'),
        fetchEdamam('Dinner'),
        fetchEdamam('Snack'),
        fetchEdamam('Teatime'), // Edamam doesn't have "Drink", uses Teatime for lighter fare
        fetchEdamam('Snack', 'world') // Desserts/Treats
    ]);

    // Fallback default curated meal plans if external API returns empty
    const DEFAULT_BREAKFAST = [
      { id: 'b1', title: 'Avocado Toast with Poached Eggs', calories: 420, image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?q=80&w=800&auto=format&fit=crop', subtitle: '420 kcal' },
      { id: 'b2', title: 'Greek Yogurt Berry Parfait', calories: 310, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=800&auto=format&fit=crop', subtitle: '310 kcal' },
      { id: 'b3', title: 'Oatmeal with Honey & Almonds', calories: 350, image: 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?q=80&w=800&auto=format&fit=crop', subtitle: '350 kcal' },
      { id: 'b4', title: 'Spinach & Mushroom Omelette', calories: 380, image: 'https://images.unsplash.com/photo-1510693206972-df098062cb71?q=80&w=800&auto=format&fit=crop', subtitle: '380 kcal' }
    ];

    const DEFAULT_LUNCH = [
      { id: 'l1', title: 'Grilled Chicken Caesar Salad', calories: 520, image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=800&auto=format&fit=crop', subtitle: '520 kcal' },
      { id: 'l2', title: 'Quinoa Power Bowl with Tofu', calories: 460, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop', subtitle: '460 kcal' },
      { id: 'l3', title: 'Mediterranean Salmon & Veggies', calories: 580, image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=800&auto=format&fit=crop', subtitle: '580 kcal' },
      { id: 'l4', title: 'Turkey & Avocado Wrap', calories: 490, image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?q=80&w=800&auto=format&fit=crop', subtitle: '490 kcal' }
    ];

    const DEFAULT_DINNER = [
      { id: 'd1', title: 'Herb-Roasted Salmon with Asparagus', calories: 540, image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=800&auto=format&fit=crop', subtitle: '540 kcal' },
      { id: 'd2', title: 'Lean Beef & Broccoli Stir-Fry', calories: 590, image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?q=80&w=800&auto=format&fit=crop', subtitle: '590 kcal' },
      { id: 'd3', title: 'Baked Chicken Breast & Sweet Potato', calories: 510, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?q=80&w=800&auto=format&fit=crop', subtitle: '510 kcal' },
      { id: 'd4', title: 'Lentil & Vegetable Curry', calories: 450, image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?q=80&w=800&auto=format&fit=crop', subtitle: '450 kcal' }
    ];

    if (!breakfast || breakfast.length === 0) breakfast = DEFAULT_BREAKFAST;
    if (!lunch || lunch.length === 0) lunch = DEFAULT_LUNCH;
    if (!dinner || dinner.length === 0) dinner = DEFAULT_DINNER;
    if (!snacks || snacks.length === 0) snacks = [DEFAULT_BREAKFAST[1]];
    if (!drinks || drinks.length === 0) drinks = [{ id: 'dr1', title: 'Green Detox Smoothie', calories: 180, image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?q=80&w=800&auto=format&fit=crop', subtitle: '180 kcal' }];
    if (!desserts || desserts.length === 0) desserts = [{ id: 'ds1', title: 'Dark Chocolate Chia Pudding', calories: 240, image: 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?q=80&w=800&auto=format&fit=crop', subtitle: '240 kcal' }];

    return NextResponse.json({
      breakfast,
      lunch,
      dinner,
      snacks,
      drinks,
      desserts
    });

  } catch (error: any) {
    console.error('daily-meal-plan API Error:', error);
    return NextResponse.json({
      breakfast: [
        { id: 'b1', title: 'Avocado Toast with Poached Eggs', calories: 420, image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?q=80&w=800&auto=format&fit=crop', subtitle: '420 kcal' },
        { id: 'b2', title: 'Greek Yogurt Berry Parfait', calories: 310, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=800&auto=format&fit=crop', subtitle: '310 kcal' }
      ],
      lunch: [
        { id: 'l1', title: 'Grilled Chicken Caesar Salad', calories: 520, image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=800&auto=format&fit=crop', subtitle: '520 kcal' },
        { id: 'l2', title: 'Quinoa Power Bowl with Tofu', calories: 460, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop', subtitle: '460 kcal' }
      ],
      dinner: [
        { id: 'd1', title: 'Herb-Roasted Salmon with Asparagus', calories: 540, image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=800&auto=format&fit=crop', subtitle: '540 kcal' },
        { id: 'd2', title: 'Lean Beef & Broccoli Stir-Fry', calories: 590, image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?q=80&w=800&auto=format&fit=crop', subtitle: '590 kcal' }
      ],
      snacks: [], drinks: [], desserts: []
    });
  }
}
