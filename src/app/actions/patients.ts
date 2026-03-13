'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  ActionResult,
  Patient,
  PatientWithProfile,
  CreatePatientInput,
  Gender,
  BloodGroup,
} from '@/types'

/**
 * Get all patients with their profile information
 */
export async function getPatients(): Promise<ActionResult<PatientWithProfile[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('patients')
    .select(`
      *,
      profile:profiles(*)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch patients',
    }
  }

  return {
    success: true,
    data: (data || []) as PatientWithProfile[],
  }
}

/**
 * Get a single patient by ID with profile information
 */
export async function getPatientById(
  id: string
): Promise<ActionResult<PatientWithProfile>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('patients')
    .select(`
      *,
      profile:profiles(*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return {
        success: false,
        error: 'Patient not found',
      }
    }
    return {
      success: false,
      error: error.message || 'Failed to fetch patient',
    }
  }

  return {
    success: true,
    data: data as PatientWithProfile,
  }
}

/**
 * Get patient by profile ID (for patient viewing own data)
 */
export async function getPatientByProfileId(
  profileId: string
): Promise<ActionResult<PatientWithProfile>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('patients')
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
        error: 'Patient not found',
      }
    }
    return {
      success: false,
      error: error.message || 'Failed to fetch patient',
    }
  }

  return {
    success: true,
    data: data as PatientWithProfile,
  }
}

/**
 * Create a new patient
 * Note: The auth user must already exist. This only creates the patient record.
 */
export async function createPatient(
  data: {
    profileId: string
    date_of_birth?: string | null
    gender?: Gender | null
    blood_group?: BloodGroup | null
    address?: string | null
    emergency_contact?: string | null
    medical_history?: string | null
  }
): Promise<ActionResult<Patient>> {
  const supabase = await createClient()

  // Create patient record using the provided profileId
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .insert({
      profile_id: data.profileId,
      date_of_birth: data.date_of_birth || null,
      gender: data.gender || null,
      blood_group: data.blood_group || null,
      address: data.address || null,
      emergency_contact: data.emergency_contact || null,
      medical_history: data.medical_history || null,
    })
    .select()
    .single()

  if (patientError) {
    return {
      success: false,
      error: patientError.message || 'Failed to create patient record',
    }
  }

  revalidatePath('/patients')
  revalidatePath('/dashboard')

  return {
    success: true,
    data: patient as Patient,
  }
}

/**
 * Update a patient's information
 */
export async function updatePatient(
  id: string,
  data: Partial<Omit<Patient, 'id' | 'profile_id' | 'created_at'>>
): Promise<ActionResult<Patient>> {
  const supabase = await createClient()

  const { data: patient, error } = await supabase
    .from('patients')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return {
        success: false,
        error: 'Patient not found',
      }
    }
    return {
      success: false,
      error: error.message || 'Failed to update patient',
    }
  }

  revalidatePath('/patients')
  revalidatePath('/dashboard')
  revalidatePath(`/patients/${id}`)

  return {
    success: true,
    data: patient as Patient,
  }
}

/**
 * Search patients by name or phone
 * Uses ilike for case-insensitive partial matching on profiles table
 */
export async function searchPatients(
  query: string
): Promise<ActionResult<PatientWithProfile[]>> {
  const supabase = await createClient()

  if (!query || query.trim().length === 0) {
    return {
      success: true,
      data: [],
    }
  }

  const searchTerm = `%${query.trim()}%`

  // Step 1: Search profiles table directly for matching first_name, last_name, or phone
  const { data: matchingProfiles, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},phone.ilike.${searchTerm}`)
    .limit(20)

  if (profileError) {
    return {
      success: false,
      error: profileError.message || 'Failed to search profiles',
    }
  }

  if (!matchingProfiles || matchingProfiles.length === 0) {
    return {
      success: true,
      data: [],
    }
  }

  // Step 2: Get profile IDs
  const profileIds = matchingProfiles.map((p) => (p as { id: string }).id)

  // Step 3: Fetch patients whose profile_id is in the matching IDs
  const { data: patients, error: patientError } = await supabase
    .from('patients')
    .select(`
      *,
      profile:profiles(*)
    `)
    .in('profile_id', profileIds)
    .order('created_at', { ascending: false })
    .limit(20)

  if (patientError) {
    return {
      success: false,
      error: patientError.message || 'Failed to fetch patients',
    }
  }

  return {
    success: true,
    data: (patients || []) as PatientWithProfile[],
  }
}
