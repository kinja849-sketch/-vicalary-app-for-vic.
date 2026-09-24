"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    // Handle the OAuth callback
    // For implicit flow: the hash fragment (#access_token=...) is automatically
    // detected by Supabase JS when it initializes, setting the session.
    // For PKCE flow: the ?code= parameter needs to be exchanged.
    
    const handleCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      
      if (accessToken) {
        // Implicit flow - Supabase JS auto-detects the hash fragment
        // Wait for Supabase to process it
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (session) {
          console.log('[Auth Callback] Session established via implicit flow')
          router.replace('/dashboard')
          return
        }
        
        if (error) {
          console.error('[Auth Callback] Session error:', error.message)
        }
      }

      // Check for PKCE code parameter
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          console.log('[Auth Callback] Session established via PKCE flow')
          router.replace('/dashboard')
          return
        }
        console.error('[Auth Callback] Code exchange failed:', error.message)
      }

      // Listen for auth state change as a fallback
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          console.log('[Auth Callback] Auth state change: SIGNED_IN')
          router.replace('/dashboard')
        }
      })

      // Timeout fallback - if nothing happens after 5 seconds, go to auth
      const timeout = setTimeout(() => {
        console.warn('[Auth Callback] Timeout - redirecting to auth')
        subscription.unsubscribe()
        router.replace('/auth')
      }, 5000)

      return () => {
        clearTimeout(timeout)
        subscription.unsubscribe()
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen w-full bg-[#0b141a]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-vic-green mx-auto mb-4"></div>
        <p className="text-white text-sm">Completing sign in...</p>
      </div>
    </div>
  )
}
