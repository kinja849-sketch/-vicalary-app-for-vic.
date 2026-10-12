import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req).catch(() => null);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const bodyUserId = formData.get('userId') as string | null;

    const targetUserId = authUser?.id || bodyUserId;

    if (!targetUserId) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in to update your avatar.' }, { status: 401 });
    }

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // 1. Max size: 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Image size exceeds maximum limit of 10MB' }, { status: 400 });
    }

    // 2. MIME type validation
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif'
    };

    let fileExt = mimeMap[file.type.toLowerCase()];
    if (!fileExt) {
      // Check filename extension as fallback
      const extMatch = file.name.match(/\.(jpe?g|png|webp|gif)$/i);
      if (extMatch) {
        fileExt = extMatch[1].toLowerCase().replace('jpeg', 'jpg');
      } else {
        return NextResponse.json({ error: 'Invalid image format. Supported formats: JPG, PNG, WEBP, GIF' }, { status: 400 });
      }
    }

    const adminSupabase = createAdminSupabaseClient();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${targetUserId}/${fileName}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Upload with service role admin client (bypasses RLS blocks on storage)
    const { error: uploadError } = await adminSupabase.storage
      .from('user-avatars')
      .upload(filePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('[Avatar API] Storage upload error:', uploadError);
      return NextResponse.json({ error: `Storage error: ${uploadError.message}` }, { status: 500 });
    }

    // 4. Retrieve public URL
    const { data: { publicUrl } } = adminSupabase.storage
      .from('user-avatars')
      .getPublicUrl(filePath);

    // 5. Update user_profiles table
    const { error: profileError } = await adminSupabase
      .from('user_profiles')
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', targetUserId);

    if (profileError) {
      console.warn('[Avatar API] user_profiles update error:', profileError);
    }

    // 6. Update Auth user metadata
    try {
      await adminSupabase.auth.admin.updateUserById(targetUserId, {
        user_metadata: { avatar_url: publicUrl }
      });
    } catch (metaErr) {
      console.warn('[Avatar API] User metadata update warning:', metaErr);
    }

    return NextResponse.json({
      success: true,
      avatar_url: publicUrl
    });

  } catch (error: any) {
    console.error('[Avatar API] Unexpected error:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload avatar' }, { status: 500 });
  }
}
