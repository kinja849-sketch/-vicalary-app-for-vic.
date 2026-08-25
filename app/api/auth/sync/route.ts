import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, email, full_name, avatar_url } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Initialize Supabase client with Service Role Key to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase Service Role configuration');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log(`[API Sync] Synchronizing profile for user: ${id}`);

    const cleanId = String(id).replace(/^["']|["']$/g, '').trim();

    // Check existing profile so we don't overwrite user-uploaded avatars
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('full_name, avatar_url')
      .eq('id', cleanId)
      .maybeSingle();

    const profilePayload: any = {
      id: cleanId,
      email: email || '',
      updated_at: new Date().toISOString(),
    };

    // Only update name if it doesn't exist or is empty
    if (full_name && (!existingProfile || !existingProfile.full_name || existingProfile.full_name === '-')) {
      profilePayload.full_name = full_name;
    }

    // Only update avatar if the user doesn't already have one in their profile!
    if (avatar_url && (!existingProfile || !existingProfile.avatar_url)) {
      profilePayload.avatar_url = avatar_url;
    }

    const { data: profileRows, error: upsertError } = await supabaseAdmin
      .from('user_profiles')
      .upsert(profilePayload, {
        onConflict: 'id'
      })
      .select('*')
      .limit(1);

    if (upsertError) {
      console.error("[API Sync] Error syncing profile:", upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const profile = profileRows && profileRows.length > 0 ? profileRows[0] : null;

    // Handle user settings
    if (profile) {
      const { data: settingsRows } = await supabaseAdmin
        .from('user_settings')
        .select('*')
        .eq('user_id', profile.id)
        .limit(1);

      if (!settingsRows || settingsRows.length === 0) {
        await supabaseAdmin.from('user_settings').insert({
          user_id: profile.id,
          language: 'en',
          currency: 'USD',
          timezone: 'UTC',
          theme: 'light'
        });
      }
    }

    return NextResponse.json({ profile }, { status: 200 });

  } catch (error: any) {
    console.error("[API Sync] Unexpected error:", error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
