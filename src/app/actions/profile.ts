'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ActionResult, Profile } from '@/types'

/**
 * Get the current user's profile from the profiles table
 * Returns null if user is not authenticated or profile doesn't exist
 */
export async function getProfile(): Promise<ActionResult<Profile | null>> {
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      success: false,
      error: 'Not authenticated',
    }
  }

  // Fetch profile from database
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) {
    // Handle specific error cases
    if (profileError.code === 'PGRST116') {
      // No rows returned - profile doesn't exist
      return {
        success: false,
        error: 'Profile not found',
      }
    }

    return {
      success: false,
      error: profileError.message || 'Failed to fetch profile',
    }
  }

  return {
    success: true,
    data: profile as Profile,
  }
}

/**
 * Update the current user's profile
 * Only updates first_name, last_name, and phone fields
 */
export async function updateProfile(
  formData: FormData
): Promise<ActionResult<Profile>> {
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      success: false,
      error: 'Not authenticated',
    }
  }

  // Extract updateable fields from form data
  const firstName = formData.get('firstName') as string | null
  const lastName = formData.get('lastName') as string | null
  const phone = formData.get('phone') as string | null

  // Build update object with only provided fields
  const updates: Partial<Pick<Profile, 'first_name' | 'last_name' | 'phone'>> = {}
  
  if (firstName !== null) {
    updates.first_name = firstName
  }
  if (lastName !== null) {
    updates.last_name = lastName
  }
  if (phone !== null) {
    updates.phone = phone
  }

  // Check if there are any fields to update
  if (Object.keys(updates).length === 0) {
    return {
      success: false,
      error: 'No fields to update',
    }
  }

  // Update profile in database
  const { data: profile, error: updateError } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()

  if (updateError) {
    return {
      success: false,
      error: updateError.message || 'Failed to update profile',
    }
  }

  // Revalidate the profile path to update cached data
  revalidatePath('/profile')
  revalidatePath('/dashboard')

  return {
    success: true,
    data: profile as Profile,
  }
}

/**
 * Update profile with direct data object (alternative to FormData)
 * Useful for programmatic updates
 */
export async function updateProfileData(
  data: Partial<Pick<Profile, 'first_name' | 'last_name' | 'phone'>>
): Promise<ActionResult<Profile>> {
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      success: false,
      error: 'Not authenticated',
    }
  }

  // Check if there are any fields to update
  if (Object.keys(data).length === 0) {
    return {
      success: false,
      error: 'No fields to update',
    }
  }

  // Update profile in database
  const { data: profile, error: updateError } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', user.id)
    .select()
    .single()

  if (updateError) {
    return {
      success: false,
      error: updateError.message || 'Failed to update profile',
    }
  }

  // Revalidate the profile path to update cached data
  revalidatePath('/profile')
  revalidatePath('/dashboard')

  return {
    success: true,
    data: profile as Profile,
  }
}
