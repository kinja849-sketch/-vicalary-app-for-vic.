import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, email, phoneNumber, countryCode, channel = 'sms' } = body

    if (!email && !phoneNumber) {
      return NextResponse.json({ success: false, message: 'Email or Phone Number is required' }, { status: 400 })
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const supabase = supabaseAdmin
    const identifier = email || phoneNumber

    console.log(`[VERIFICATION] Preparing code for ${identifier}`)

    if (email) {
      const { error: dbError } = await supabase
        .from('email_verification_codes')
        .upsert([{ 
          user_id: userId || null, 
          email: email.trim().toLowerCase(), 
          code: verificationCode, 
          expires_at: expiresAt 
        }], { onConflict: 'email' })

      if (dbError) throw new Error(`Database error (email): ${dbError.message}`)
    } else if (phoneNumber) {
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
          user_id: userId || null, 
          phone_number: cleanPhone, 
          country_code: countryCode.replace(/\D/g, ''), 
          is_verified: false, 
          verification_code: verificationCode, 
          verification_expires_at: expiresAt
        }], { onConflict: 'phone_number' })

      if (dbError) throw new Error(`Database error (phone): ${dbError.message}`)
    }

    console.log(`[VERIFICATION] Sending ${verificationCode} to ${identifier} via ${channel}`)

    return NextResponse.json({ success: true, message: 'Code sent', code: verificationCode })
  } catch (error: any) {
    console.error('send-otp error:', error)
    return NextResponse.json({ success: false, message: error.message || 'An unexpected error occurred' }, { status: 400 })
  }
}
