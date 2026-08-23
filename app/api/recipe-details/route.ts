import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) throw new Error('ID is required')

    const supabase = createServerSupabaseClient()

    // 1. Check unified cache first
    const { data: existing, error } = await supabase
        .from('cached_recipes')
        .select('*')
        .eq('id', id)
        .maybeSingle()

    if (existing) {
        // Map to expected frontend schema
        const mapped = {
            id: existing.id,
            title: existing.title,
            image_url: existing.image_url,
            cuisine_type: existing.cuisine_region,
            dietary_tags: [],
            ingredients: typeof existing.ingredients === 'string' ? JSON.parse(existing.ingredients) : (existing.ingredients || []),
            instructions: typeof existing.instructions_steps === 'string' ? JSON.parse(existing.instructions_steps) : (existing.instructions_steps || []),
            prep_time_minutes: existing.preparation_time,
            cook_time_minutes: 0,
            total_calories: existing.nutrition?.calories || 0,
            protein_g: existing.nutrition?.protein || 0,
            carbs_g: existing.nutrition?.carbs || 0,
            fat_g: existing.nutrition?.fat || 0
        };
        return NextResponse.json(mapped)
    }

    // 2. Fallback check for legacy cached entries just in case
    const { data: legacyExisting } = await supabase
        .from('recipes')
        .select('*')
        .eq('external_id', id)
        .maybeSingle()
        
    if (legacyExisting) return NextResponse.json(legacyExisting)

    return NextResponse.json({ error: 'Recipe not found in cache. Ensure it was fetched via recommendations API first.' }, { status: 404 })

  } catch (error: any) {
    console.error('recipe-details error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
