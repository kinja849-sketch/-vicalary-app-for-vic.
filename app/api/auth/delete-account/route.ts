import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id

    console.log(`[Delete-Account] Starting Total Wipe for user: ${userId}`)

    // 1. Delete Storage Assets (Storage is not handled by DB cascades)
    const buckets = ['user-avatars', 'food-images', 'chat-media']
    for (const bucket of buckets) {
      try {
        const { data: files } = await supabaseAdmin.storage.from(bucket).list(userId)
        if (files && files.length > 0) {
          const filesToDelete = files.map(f => `${userId}/${f.name}`)
          await supabaseAdmin.storage.from(bucket).remove(filesToDelete)
          console.log(`[Delete-Account] Cleaned bucket: ${bucket}`)
        }
      } catch (e) {
        console.warn(`[Delete-Account] Storage cleanup failed for ${bucket}:`, e)
      }
    }

    // 2. Delete Supabase Auth User
    // This will trigger the ON DELETE CASCADE in the database (user_profiles and children)
    // and fire the handle_auth_user_deletion() trigger for deep cleanup.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error('[Delete-Account] Auth deletion failed:', deleteError)
      throw deleteError
    }

    console.log(`[Delete-Account] Successfully deleted user: ${userId}`)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Delete-Account] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
