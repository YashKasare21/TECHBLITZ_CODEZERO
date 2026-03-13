'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'
import { ActionResult, UserRole } from '../../types'

/**
 * Sign in with email and password
 * On success: fetches profile role and redirects to role-based route
 */
export async function signIn(formData: FormData): Promise<ActionResult<never>> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Validate required fields
  if (!email || !password) {
    return {
      success: false,
      error: 'Email and password are required',
    }
  }

  const supabase = await createClient()

  // Attempt sign in
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Handle specific Supabase auth error codes
    switch (error.code) {
      case 'invalid_credentials':
        return {
          success: false,
          error: 'Invalid email or password',
        }
      case 'email_not_confirmed':
        return {
          success: false,
          error: 'Please confirm your email before signing in',
        }
      case 'user_not_found':
        return {
          success: false,
          error: 'No account found with this email',
        }
      default:
        return {
          success: false,
          error: error.message || 'Failed to sign in',
        }
    }
  }

  if (!data.user) {
    return {
      success: false,
      error: 'Authentication failed',
    }
  }

  // Fetch user profile to determine role-based redirect
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) {
    // Profile should exist due to trigger, but handle edge case
    await supabase.auth.signOut()
    return {
      success: false,
      error: 'User profile not found. Please contact support.',
    }
  }

  // Role-based redirect
  const role = profile.role as UserRole
  let redirectPath = '/dashboard'

  switch (role) {
    case 'admin':
    case 'receptionist':
      redirectPath = '/dashboard'
      break
    case 'doctor':
      redirectPath = '/schedule'
      break
    case 'patient':
      redirectPath = '/appointments'
      break
    default:
      redirectPath = '/dashboard'
  }

  // Revalidate and redirect
  revalidatePath('/', 'layout')
  redirect(redirectPath)
}

/**
 * Sign up a new user
 * Creates auth user with metadata that triggers profile creation
 */
export async function signUp(formData: FormData): Promise<ActionResult<{ email: string }>> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const role = formData.get('role') as string
  const phone = formData.get('phone') as string

  // Validate required fields
  if (!email || !password) {
    return {
      success: false,
      error: 'Email and password are required',
    }
  }

  if (!role) {
    return {
      success: false,
      error: 'Role is required',
    }
  }

  // Validate password strength
  if (password.length < 6) {
    return {
      success: false,
      error: 'Password must be at least 6 characters',
    }
  }

  const supabase = await createClient()

  // Attempt sign up with user metadata
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName || '',
        last_name: lastName || '',
        role: role,
        phone: phone || '',
      },
    },
  })

  if (error) {
    // Handle specific Supabase auth error codes
    switch (error.code) {
      case 'user_already_exists':
        return {
          success: false,
          error: 'An account with this email already exists',
        }
      case 'weak_password':
        return {
          success: false,
          error: 'Password is too weak',
        }
      case 'invalid_email':
        return {
          success: false,
          error: 'Please enter a valid email address',
        }
      default:
        return {
          success: false,
          error: error.message || 'Failed to create account',
        }
    }
  }

  if (!data.user) {
    return {
      success: false,
      error: 'Registration failed',
    }
  }

  // Update profile with role and phone since trigger may not capture all fields
  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({
      role: role as UserRole,
      phone: phone || null,
    })
    .eq('id', data.user.id)

  if (profileUpdateError) {
    console.error('Profile update error:', profileUpdateError.message)
    // Non-fatal — profile exists, just role may default to patient
  }

  // Revalidate and redirect to login with success message
  revalidatePath('/', 'layout')
  redirect('/login?message=check_your_email')
}

/**
 * Sign out the current user
 * Clears session and redirects to login
 */
export async function signOut(): Promise<ActionResult<never>> {
  const supabase = await createClient()
  
  const { error } = await supabase.auth.signOut()

  if (error) {
    return {
      success: false,
      error: error.message || 'Failed to sign out',
    }
  }

  revalidatePath('/', 'layout')
  redirect('/login')
}
