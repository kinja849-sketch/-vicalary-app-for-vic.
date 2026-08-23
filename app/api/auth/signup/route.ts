import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getVerificationHtml } from './template';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Safety Check: Check for orphaned public profiles with this email
    // This handles cases where auth.users was deleted but public data remained.
    // This ensures that when a user signs up again, they start with a CLEAN SLATE.
    const { data: orphanedProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (orphanedProfile) {
      console.log(`[Signup-Defensive] Found orphaned profile for ${normalizedEmail}. Performing safety wipe...`);
      // Wipe storage
      const buckets = ['user-avatars', 'food-images', 'chat-media'];
      for (const bucket of buckets) {
        try {
          const { data: files } = await supabaseAdmin.storage.from(bucket).list(orphanedProfile.id);
          if (files && files.length > 0) {
            const paths = files.map(f => `${orphanedProfile.id}/${f.name}`);
            await supabaseAdmin.storage.from(bucket).remove(paths);
          }
        } catch (e) {}
      }
      // Delete from DB (The cascade will handle related tables if SQL was applied)
      await supabaseAdmin.from('user_profiles').delete().eq('id', orphanedProfile.id);
      console.log(`[Signup-Defensive] Orphaned data for ${normalizedEmail} has been purged.`);
    }

    // 2. Super Reset Logic: If a user needs a hard reset (dev only), delete them from auth.users
    const isSuperReset = normalizedEmail.includes('super');
    if (isSuperReset) {
      const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
      const users = userData?.users || [];
      const existingUser = users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
      
      if (existingUser) {
        console.log(`[HARD RESET] Deleting existing auth.user ${existingUser.id}...`);
        
        // Storage Cleanup
        const buckets = ['user-avatars', 'food-images', 'chat-media'];
        for (const bucket of buckets) {
          try {
            const { data: files } = await supabaseAdmin.storage.from(bucket).list(existingUser.id);
            if (files && files.length > 0) {
              const paths = files.map(f => `${existingUser.id}/${f.name}`);
              await supabaseAdmin.storage.from(bucket).remove(paths);
            }
          } catch (e) {}
        }
        
        await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
      }
    }

    // 3. Generate Verification Link via Supabase Admin Client
    // This creates the user in the unconfirmed state in auth.users and generates the link.
    // By doing this on the server via admin key, we bypass Supabase's Custom SMTP completely,
    // avoiding the 504 Gateway Timeout!
    const requestUrl = new URL(request.url);
    const redirectTo = `${requestUrl.origin}/onboarding`;

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: normalizedEmail,
      password: password,
      options: {
        redirectTo: redirectTo
      }
    });

    if (linkError) {
      console.error('[Signup-LinkError]', linkError);
      return NextResponse.json(
        { error: linkError.message },
        { status: 400 }
      );
    }

    if (!linkData || !linkData.properties || !linkData.properties.action_link) {
      console.error('[Signup-LinkError] No action link generated');
      return NextResponse.json(
        { error: 'Failed to generate verification link.' },
        { status: 500 }
      );
    }

    const actionLink = linkData.properties.action_link;

    // 4. Send Email via Resend REST API directly
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('[Signup-Resend-Error] RESEND_API_KEY is not defined in environment variables.');
      return NextResponse.json(
        { error: 'Resend API key is missing. Please add RESEND_API_KEY to your .env.local file to send verification emails.' },
        { status: 500 }
      );
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@vicalary.com';

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: `Vicalary <${fromEmail}>`,
        to: [normalizedEmail],
        subject: 'Almost There! - Vicalary',
        html: getVerificationHtml(actionLink)
      })
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('[Signup-Resend-Error]', resendResult);
      return NextResponse.json(
        { error: resendResult.message || 'Failed to send verification email via Resend' },
        { status: 500 }
      );
    }

    console.log('[Signup-Success] User created and verification email sent successfully:', linkData.user?.id);

    return NextResponse.json({ 
      success: true,
      message: 'Cleanup finished, user created, and verification email sent.' 
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
