'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  ActionResult,
  Doctor,
  DoctorWithProfile,
  CreateDoctorInput,
  DoctorSession,
  Holiday,
  UpsertDoctorSession,
} from '@/types'

/**
 * Get all doctors with their profile information
 */
export async function getDoctors(): Promise<ActionResult<DoctorWithProfile[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('doctors')
    .select(`
      *,
      profile:profiles(*)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch doctors',
    }
  }

  return {
    success: true,
    data: (data || []) as DoctorWithProfile[],
  }
}

/**
 * Get a single doctor by ID with profile and sessions
 */
export async function getDoctorById(
  id: string
): Promise<ActionResult<DoctorWithProfile & { sessions: DoctorSession[] }>> {
  const supabase = await createClient()

  // Get doctor with profile
  const { data: doctor, error: doctorError } = await supabase
    .from('doctors')
    .select(`
      *,
      profile:profiles(*)
    `)
    .eq('id', id)
    .single()

  if (doctorError) {
    if (doctorError.code === 'PGRST116') {
      return {
        success: false,
        error: 'Doctor not found',
      }
    }
    return {
      success: false,
      error: doctorError.message || 'Failed to fetch doctor',
    }
  }

  // Get doctor sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from('doctor_sessions')
    .select('*')
    .eq('doctor_id', id)
    .order('day_of_week', { ascending: true })

  if (sessionsError) {
    return {
      success: false,
      error: sessionsError.message || 'Failed to fetch doctor sessions',
    }
  }

  return {
    success: true,
    data: {
      ...(doctor as DoctorWithProfile),
      sessions: (sessions || []) as DoctorSession[],
    },
  }
}

/**
 * Get doctor by profile ID (for doctor viewing own data)
 */
export async function getDoctorByProfileId(
  profileId: string
): Promise<ActionResult<DoctorWithProfile>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('doctors')
    .select(`
      *,
      profile:profiles(*)
    `)
    .eq('profile_id', profileId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return {
        success: false,
        error: 'Doctor not found',
      }
    }
    return {
      success: false,
      error: error.message || 'Failed to fetch doctor',
    }
  }

  return {
    success: true,
    data: data as DoctorWithProfile,
  }
}

/**
 * Create a new doctor
 * Note: The auth user must already exist. This only creates the doctor record.
 */
export async function createDoctor(
  data: {
    profileId: string
    specialty: string
    qualification?: string | null
    experience_years?: number | null
    bio?: string | null
    consultation_fee?: number | null
  }
): Promise<ActionResult<Doctor>> {
  const supabase = await createClient()

  // Create doctor record using the provided profileId
  const { data: doctor, error: doctorError } = await supabase
    .from('doctors')
    .insert({
      profile_id: data.profileId,
      specialty: data.specialty,
      qualification: data.qualification || null,
      experience_years: data.experience_years || null,
      bio: data.bio || null,
      consultation_fee: data.consultation_fee || null,
    })
    .select()
    .single()

  if (doctorError) {
    return {
      success: false,
      error: doctorError.message || 'Failed to create doctor record',
    }
  }

  revalidatePath('/doctors')
  revalidatePath('/dashboard')

  return {
    success: true,
    data: doctor as Doctor,
  }
}

/**
 * Update a doctor's information
 */
export async function updateDoctor(
  id: string,
  data: Partial<Omit<Doctor, 'id' | 'profile_id' | 'created_at'>>
): Promise<ActionResult<Doctor>> {
  const supabase = await createClient()

  const { data: doctor, error } = await supabase
    .from('doctors')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return {
        success: false,
        error: 'Doctor not found',
      }
    }
    return {
      success: false,
      error: error.message || 'Failed to update doctor',
    }
  }

  revalidatePath('/doctors')
  revalidatePath('/dashboard')
  revalidatePath(`/doctors/${id}`)

  return {
    success: true,
    data: doctor as Doctor,
  }
}

/**
 * Get doctor sessions (working hours) for all days
 */
export async function getDoctorSessions(
  doctorId: string
): Promise<ActionResult<DoctorSession[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('doctor_sessions')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('day_of_week', { ascending: true })

  if (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch doctor sessions',
    }
  }

  return {
    success: true,
    data: (data || []) as DoctorSession[],
  }
}

/**
 * Update all 7 day sessions for a doctor using upsert
 * This handles both creating new sessions and updating existing ones
 */
export async function updateDoctorSessions(
  doctorId: string,
  sessions: UpsertDoctorSession[]
): Promise<ActionResult<DoctorSession[]>> {
  const supabase = await createClient()

  // Prepare sessions with doctor_id
  const sessionsToUpsert = sessions.map((session) => ({
    doctor_id: doctorId,
    day_of_week: session.day_of_week,
    start_time: session.start_time,
    end_time: session.end_time,
    is_available: session.is_available,
  }))

  // Upsert sessions - update on conflict with (doctor_id, day_of_week)
  const { data, error } = await supabase
    .from('doctor_sessions')
    .upsert(sessionsToUpsert, {
      onConflict: 'doctor_id,day_of_week',
    })
    .select()

  if (error) {
    return {
      success: false,
      error: error.message || 'Failed to update doctor sessions',
    }
  }

  revalidatePath('/schedule')
  revalidatePath(`/doctors/${doctorId}`)

  return {
    success: true,
    data: (data || []) as DoctorSession[],
  }
}

/**
 * Add a holiday for a doctor
 */
export async function addHoliday(
  data: {
    doctor_id: string
    holiday_date: string
    start_time?: string | null
    end_time?: string | null
    is_full_day?: boolean
    reason?: string | null
  }
): Promise<ActionResult<Holiday>> {
  const supabase = await createClient()

  const { data: holiday, error } = await supabase
    .from('holidays')
    .insert({
      doctor_id: data.doctor_id,
      holiday_date: data.holiday_date,
      start_time: data.start_time || null,
      end_time: data.end_time || null,
      is_full_day: data.is_full_day ?? true,
      reason: data.reason || null,
    })
    .select()
    .single()

  if (error) {
    return {
      success: false,
      error: error.message || 'Failed to add holiday',
    }
  }

  revalidatePath('/schedule')
  revalidatePath(`/doctors/${data.doctor_id}`)

  return {
    success: true,
    data: holiday as Holiday,
  }
}

/**
 * Remove a holiday
 */
export async function removeHoliday(
  id: string
): Promise<ActionResult<void>> {
  const supabase = await createClient()

  // Get doctor_id before deleting for revalidation
  const { data: holiday, error: fetchError } = await supabase
    .from('holidays')
    .select('doctor_id')
    .eq('id', id)
    .single()

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return {
        success: false,
        error: 'Holiday not found',
      }
    }
    return {
      success: false,
      error: fetchError.message || 'Failed to fetch holiday',
    }
  }

  const { error } = await supabase
    .from('holidays')
    .delete()
    .eq('id', id)

  if (error) {
    return {
      success: false,
      error: error.message || 'Failed to remove holiday',
    }
  }

  revalidatePath('/schedule')
  revalidatePath(`/doctors/${(holiday as { doctor_id: string }).doctor_id}`)

  return {
    success: true,
  }
}

/**
 * Get doctor holidays within a date range
 */
export async function getDoctorHolidays(
  doctorId: string,
  fromDate?: string,
  toDate?: string
): Promise<ActionResult<Holiday[]>> {
  const supabase = await createClient()

  let query = supabase
    .from('holidays')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('holiday_date', { ascending: true })

  if (fromDate) {
    query = query.gte('holiday_date', fromDate)
  }

  if (toDate) {
    query = query.lte('holiday_date', toDate)
  }

  const { data, error } = await query

  if (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch holidays',
    }
  }

  return {
    success: true,
    data: (data || []) as Holiday[],
  }
}
