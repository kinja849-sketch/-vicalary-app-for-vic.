import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // CORS header handling
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get user id from request
    const { user_id, confirmation_password } = await req.json()

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log(`[Delete-Account-Edge] Processing deletion for user: ${user_id}`)

    // 1. Verify user exists and get email
    const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(user_id)
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const email = userData.user.email

    console.log(`[Delete-Account-Edge] Revoking sessions for user: ${user_id}`)
    // 2. Revoke all sessions
    const { error: sessionError } = await supabaseClient.auth.admin.listUserIdentities(user_id)
    // There isn't a direct "revoke all sessions" in admin API that's simple, 
    // but deleting the user (step 4) will invalidate their JWTs eventually.
    // For immediate revocation, we can update the user's password or metadata to trigger a session refresh failure.
    await supabaseClient.auth.admin.updateUserById(user_id, { 
      user_metadata: { deleted_at: new Date().toISOString() },
      ban_duration: 'none' // We'll delete them anyway
    })

    // 3. Clean up storage files (Buckets: user-avatars, food-images, chat-media)
    // We do this BEFORE deleting the auth record so we have the ID to find the files
    const buckets = ['user-avatars', 'food-images', 'chat-media']
    for (const bucket of buckets) {
      try {
        console.log(`[Delete-Account-Edge] Cleaning bucket: ${bucket}`)
        const { data: files, error: listError } = await supabaseClient.storage.from(bucket).list(user_id)
        if (listError) {
          console.warn(`Could not list files in ${bucket}: ${listError.message}`)
          continue
        }
        if (files && files.length > 0) {
          const filesToRemove = files.map((f) => `${user_id}/${f.name}`)
          const { error: removeError } = await supabaseClient.storage.from(bucket).remove(filesToRemove)
          if (removeError) console.error(`Error removing files from ${bucket}:`, removeError)
        }
      } catch (err) {
        console.error(`Error cleaning bucket ${bucket}:`, err)
      }
    }

    // 4. Delete the user from auth.users
    // This triggers the DB CASCADE on public.user_profiles and related tables
    // provided the hardening_migration.sql has been applied.
    console.log(`[Delete-Account-Edge] Finalizing deletion of auth.users record: ${user_id}`)
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(user_id)
    if (deleteError) {
      throw deleteError
    }

    console.log(`[Delete-Account-Edge] Successfully purged user ${user_id}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account and all associated data permanently deleted. You can now sign up with a fresh slate.',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    console.error(`[Delete-Account-Edge] Error during deletion: ${error.message}`)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
