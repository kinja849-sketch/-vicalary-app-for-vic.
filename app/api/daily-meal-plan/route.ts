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
    const [breakfast, lunch, dinner, snacks, drinks, desserts] = await Promise.all([
        fetchEdamam('Breakfast'),
        fetchEdamam('Lunch'),
        fetchEdamam('Dinner'),
        fetchEdamam('Snack'),
        fetchEdamam('Teatime'), // Edamam doesn't have "Drink", uses Teatime for lighter fare
        fetchEdamam('Snack', 'world') // Desserts/Treats
    ]);

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
        breakfast: [], lunch: [], dinner: [], snacks: [], drinks: [], desserts: []
    });
  }
}
