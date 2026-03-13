import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

/**
 * Auth callback route handler
 * Handles OAuth and email confirmation callbacks from Supabase Auth
 * Exchanges the authorization code for a session and redirects appropriately
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    
    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Successfully authenticated, redirect to the intended destination
      return NextResponse.redirect(`${origin}${next}`)
    }
    
    // Log error for debugging (in production, use proper logging)
    console.error('Auth callback error:', error.message)
  }

  // If no code or exchange failed, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
