import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    const body = await req.json()
    const { phoneNumber, code } = body
    const userId = authUser?.id || body.userId

    if (!userId || !phoneNumber || !code) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 })
    }

    if (typeof phoneNumber !== 'string' || typeof code !== 'string') {
      return NextResponse.json({ success: false, message: 'Invalid field types' }, { status: 400 })
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '')
    const supabase = supabaseAdmin

    // 1. Fetch the code from the database
    const { data: userData, error: fetchError } = await supabase
      .from('chat_users')
      .select('*')
      .eq('user_id', userId)
      .eq('phone_number', cleanPhone)
      .single()

    if (fetchError || !userData) {
      return NextResponse.json({ success: false, message: 'Verification record not found' }, { status: 404 })
    }

    // 2. Check if code matches and not expired
    const isExpired = new Date(userData.verification_expires_at) < new Date()
    
    if (userData.verification_code !== code) {
      return NextResponse.json({ success: false, message: 'Invalid verification code' }, { status: 400 })
    }

    if (isExpired) {
      return NextResponse.json({ success: false, message: 'Verification code has expired' }, { status: 400 })
    }

    // 3. Update status to verified and invalidate the used code
    const { error: updateError } = await supabase
      .from('chat_users')
      .update({ 
        is_verified: true,
        verification_code: null,
        verification_expires_at: null
      })
      .eq('id', userData.id)

    if (updateError) {
      throw new Error(`Failed to update verification status: ${updateError.message}`)
    }

    return NextResponse.json({ success: true, message: 'Phone verified successfully' })
  } catch (error: any) {
    console.error('verify-otp error:', error?.message)
    return NextResponse.json({ success: false, message: error.message || 'An unexpected error occurred' }, { status: 500 })
  }
}
