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

    // Generate Verification Link via Supabase Admin Client
    // This creates the user in the unconfirmed state in auth.users and generates the link.
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
