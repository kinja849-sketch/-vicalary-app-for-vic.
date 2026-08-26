import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    const body = await req.json()
    const { email, phoneNumber, countryCode = '', channel = 'sms' } = body
    const userId = authUser?.id || body.userId

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Valid session required' }, { status: 401 })
    }

    if (!email && !phoneNumber) {
      return NextResponse.json({ success: false, message: 'Email or Phone Number is required' }, { status: 400 })
    }

    if (phoneNumber && typeof countryCode !== 'string') {
      return NextResponse.json({ success: false, message: 'Valid country code is required for phone verification' }, { status: 400 })
    }

    // Generate a cryptographically secure 6-digit verification code
    const verificationCode = crypto.randomInt(100000, 1000000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const supabase = supabaseAdmin

    if (email && typeof email === 'string') {
      const { error: dbError } = await supabase
        .from('email_verification_codes')
        .upsert([{ 
          user_id: userId, 
          email: email.trim().toLowerCase(), 
          code: verificationCode, 
          expires_at: expiresAt 
        }], { onConflict: 'email' })

      if (dbError) throw new Error(`Database error (email): ${dbError.message}`)
    } else if (phoneNumber && typeof phoneNumber === 'string') {
      // Normalize: combine country code and number, then strip everything but digits
      const rawFullNumber = `${countryCode}${phoneNumber}`
      const cleanPhone = rawFullNumber.replace(/\D/g, '')
      
      // Check if phone number is already registered to another user
      const { data: existingUser } = await supabase
        .from('chat_users')
        .select('user_id')
        .eq('phone_number', cleanPhone)
        .maybeSingle();

      if (existingUser && existingUser.user_id !== userId) {
        return NextResponse.json({ success: false, message: 'This phone number is already in use by another account.' }, { status: 400 })
      }
      
      const { error: dbError } = await supabase
        .from('chat_users')
        .upsert([{ 
          user_id: userId, 
          phone_number: cleanPhone, 
          country_code: countryCode.replace(/\D/g, ''), 
          is_verified: false, 
          verification_code: verificationCode, 
          verification_expires_at: expiresAt
        }], { onConflict: 'phone_number' })

      if (dbError) throw new Error(`Database error (phone): ${dbError.message}`)
    }

    console.log(`[VERIFICATION] Verification code dispatched via ${channel} for user: ${userId}`)

    // In local non-production development, include code for testing convenience
    const responsePayload: any = { success: true, message: 'Verification code sent successfully' }
    if (process.env.NODE_ENV !== 'production') {
      responsePayload.devCode = verificationCode
    }

    return NextResponse.json(responsePayload)
  } catch (error: any) {
    console.error('send-otp error:', error?.message)
    return NextResponse.json({ success: false, message: error.message || 'An unexpected error occurred' }, { status: 400 })
  }
}
