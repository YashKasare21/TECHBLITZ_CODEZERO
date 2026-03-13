'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ActionResult, Service, CreateServiceInput } from '@/types'

/**
 * Get all active services
 * Returns services ordered by name
 */
export async function getServices(): Promise<ActionResult<Service[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch services',
    }
  }

  return {
    success: true,
    data: (data || []) as Service[],
  }
}

/**
 * Get all services including inactive ones
 * For admin use
 */
export async function getAllServices(): Promise<ActionResult<Service[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch services',
    }
  }

  return {
    success: true,
    data: (data || []) as Service[],
  }
}

/**
 * Get a single service by ID
 */
export async function getServiceById(
  id: string
): Promise<ActionResult<Service>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return {
        success: false,
        error: 'Service not found',
      }
    }
    return {
      success: false,
      error: error.message || 'Failed to fetch service',
    }
  }

  return {
    success: true,
    data: data as Service,
  }
}

/**
 * Create a new service
 */
export async function createService(
  data: CreateServiceInput
): Promise<ActionResult<Service>> {
  const supabase = await createClient()

  // Validate required fields
  if (!data.name || data.duration_minutes <= 0 || data.fee < 0) {
    return {
      success: false,
      error: 'Name, positive duration, and non-negative fee are required',
    }
  }

  const { data: service, error } = await supabase
    .from('services')
    .insert({
      name: data.name,
      description: data.description || null,
      duration_minutes: data.duration_minutes,
      fee: data.fee,
      is_active: data.is_active ?? true,
    })
    .select()
    .single()

  if (error) {
    return {
      success: false,
      error: error.message || 'Failed to create service',
    }
  }

  revalidatePath('/services')
  revalidatePath('/dashboard')

  return {
    success: true,
    data: service as Service,
  }
}

/**
 * Update a service
 */
export async function updateService(
  id: string,
  data: Partial<Omit<Service, 'id' | 'created_at'>>
): Promise<ActionResult<Service>> {
  const supabase = await createClient()

  const { data: service, error } = await supabase
    .from('services')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return {
        success: false,
        error: 'Service not found',
      }
    }
    return {
      success: false,
      error: error.message || 'Failed to update service',
    }
  }

  revalidatePath('/services')
  revalidatePath('/dashboard')

  return {
    success: true,
    data: service as Service,
  }
}

/**
 * Toggle a service's active status
 * Convenience method for quickly enabling/disabling services
 */
export async function toggleService(
  id: string,
  isActive: boolean
): Promise<ActionResult<Service>> {
  const supabase = await createClient()

  const { data: service, error } = await supabase
    .from('services')
    .update({ is_active: isActive })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return {
        success: false,
        error: 'Service not found',
      }
    }
    return {
      success: false,
      error: error.message || 'Failed to toggle service',
    }
  }

  revalidatePath('/services')
  revalidatePath('/dashboard')

  return {
    success: true,
    data: service as Service,
  }
}

/**
 * Delete a service
 * Only allows deletion if service is not referenced by appointments
 */
export async function deleteService(
  id: string
): Promise<ActionResult<void>> {
  const supabase = await createClient()

  // Check if service is referenced by any appointments
  const { data: appointments, error: checkError } = await supabase
    .from('appointments')
    .select('id')
    .eq('service_id', id)
    .limit(1)

  if (checkError) {
    return {
      success: false,
      error: checkError.message || 'Failed to check service usage',
    }
  }

  if (appointments && appointments.length > 0) {
    return {
      success: false,
      error: 'Cannot delete service that is referenced by appointments',
    }
  }

  // Delete the service
  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', id)

  if (error) {
    return {
      success: false,
      error: error.message || 'Failed to delete service',
    }
  }

  revalidatePath('/services')
  revalidatePath('/dashboard')

  return {
    success: true,
  }
}
