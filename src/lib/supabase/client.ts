import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a browser-side Supabase client for client components.
 * Uses the public anon key - safe to expose to the browser.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
