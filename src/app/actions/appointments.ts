'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAvailableSlots } from '@/lib/slots'
import {
  ActionResult,
  Appointment,
  AppointmentWithDetails,
  CreateAppointmentInput,
  AppointmentStatus,
  BookingSlot,
} from '@/types'

/**
 * Filter options for getting appointments
 */
interface AppointmentFilters {
  doctorId?: string
  patientId?: string
  date?: string // YYYY-MM-DD
  status?: AppointmentStatus
  dateFrom?: string // YYYY-MM-DD
  dateTo?: string // YYYY-MM-DD
}

/**
 * Get appointments with optional filters
 * Returns appointments with doctor and patient profile data joined
 */
export async function getAppointments(
  filters: AppointmentFilters = {}
): Promise<ActionResult<AppointmentWithDetails[]>> {
  const supabase = await createClient()

  let query = supabase
    .from('appointments')
    .select(`
      *,
      doctor:doctors(
        *,
        profile:profiles(id, first_name, last_name, phone, role)
      ),
      patient:patients(
        *,
        profile:profiles(id, first_name, last_name, phone, role)
      ),
      creator:profiles(id, first_name, last_name, phone, role)
    `)

  // Apply filters
  if (filters.doctorId) {
    query = query.eq('doctor_id', filters.doctorId)
  }

  if (filters.patientId) {
    query = query.eq('patient_id', filters.patientId)
  }

  if (filters.date) {
    query = query.eq('appointment_date', filters.date)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.dateFrom) {
    query = query.gte('appointment_date', filters.dateFrom)
  }

  if (filters.dateTo) {
    query = query.lte('appointment_date', filters.dateTo)
  }

  // Order by date and start time
  query = query.order('appointment_date', { ascending: false })
  query = query.order('start_time', { ascending: true })

  const { data, error } = await query

  if (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch appointments',
    }
  }

  return {
    success: true,
    data: (data || []) as AppointmentWithDetails[],
  }
}

/**
 * Get a single appointment by ID with all joined data
 */
export async function getAppointmentById(
  id: string
): Promise<ActionResult<AppointmentWithDetails | null>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      doctor:doctors(
        *,
        profile:profiles(id, first_name, last_name, phone, role)
      ),
      patient:patients(
        *,
        profile:profiles(id, first_name, last_name, phone, role)
      ),
      creator:profiles(id, first_name, last_name, phone, role)
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return {
        success: false,
        error: 'Appointment not found',
      }
    }
    return {
      success: false,
      error: error.message || 'Failed to fetch appointment',
    }
  }

  return {
    success: true,
    data: data as AppointmentWithDetails,
  }
}

/**
 * Create a new appointment
 * Validates slot availability before inserting (server-side validation)
 */
export async function createAppointment(
  data: CreateAppointmentInput
): Promise<ActionResult<Appointment>> {
  const supabase = await createClient()

  // Get current user for created_by field
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      success: false,
      error: 'Not authenticated',
    }
  }

  // Validate slot is still available (server-side re-validation)
  const appointmentDate = new Date(data.appointment_date)
  const durationMinutes =
    (new Date(`2000-01-01T${data.end_time}`).getTime() -
      new Date(`2000-01-01T${data.start_time}`).getTime()) /
    (1000 * 60)

  const slots = await getAvailableSlots(
    data.doctor_id,
    appointmentDate,
    durationMinutes
  )

  // Find the specific slot
  const slot = slots.find(
    (s) => s.startTime === data.start_time && s.endTime === data.end_time
  )

  if (!slot) {
    return {
      success: false,
      error: 'Selected time slot is not available',
    }
  }

  if (!slot.isAvailable) {
    return {
      success: false,
      error: 'This slot has already been booked',
    }
  }

  // Create the appointment
  const { data: appointment, error: insertError } = await supabase
    .from('appointments')
    .insert({
      patient_id: data.patient_id,
      doctor_id: data.doctor_id,
      appointment_date: data.appointment_date,
      start_time: data.start_time,
      end_time: data.end_time,
      visit_type: data.visit_type,
      status: 'pending',
      description: data.description || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (insertError) {
    return {
      success: false,
      error: insertError.message || 'Failed to create appointment',
    }
  }

  // Revalidate relevant paths
  revalidatePath('/appointments')
  revalidatePath('/dashboard')
  revalidatePath(`/schedule`)

  return {
    success: true,
    data: appointment as Appointment,
  }
}

/**
 * Valid status transitions for appointments
 */
const VALID_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled'],
  checked_in: ['completed', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
}

/**
 * Update appointment status with validation
 * Only allows valid status transitions
 */
export async function updateAppointmentStatus(
  id: string,
  newStatus: AppointmentStatus
): Promise<ActionResult<Appointment>> {
  const supabase = await createClient()

  // Get current appointment status
  const { data: current, error: fetchError } = await supabase
    .from('appointments')
    .select('status')
    .eq('id', id)
    .single()

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return {
        success: false,
        error: 'Appointment not found',
      }
    }
    return {
      success: false,
      error: fetchError.message || 'Failed to fetch appointment',
    }
  }

  const currentStatus = (current as { status: AppointmentStatus }).status

  // Validate status transition
  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus]
  if (!allowedTransitions.includes(newStatus)) {
    return {
      success: false,
      error: `Cannot transition from ${currentStatus} to ${newStatus}`,
    }
  }

  // Update status
  const { data: appointment, error: updateError } = await supabase
    .from('appointments')
    .update({ status: newStatus })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return {
      success: false,
      error: updateError.message || 'Failed to update appointment status',
    }
  }

  // Revalidate relevant paths
  revalidatePath('/appointments')
  revalidatePath('/dashboard')
  revalidatePath('/schedule')

  return {
    success: true,
    data: appointment as Appointment,
  }
}

/**
 * Cancel an appointment
 * Convenience wrapper around updateAppointmentStatus
 */
export async function cancelAppointment(
  id: string
): Promise<ActionResult<void>> {
  const result = await updateAppointmentStatus(id, 'cancelled')

  if (!result.success) {
    return {
      success: false,
      error: result.error,
    }
  }

  return {
    success: true,
  }
}

/**
 * Server action wrapper for getAvailableSlots
 * Allows client components to fetch available slots
 */
export async function getAvailableSlotsAction(
  doctorId: string,
  date: string, // YYYY-MM-DD format
  durationMinutes: number
): Promise<ActionResult<BookingSlot[]>> {
  const supabase = await createClient()

  // Parse date string to Date object
  const appointmentDate = new Date(date)

  try {
    const slots = await getAvailableSlots(
      doctorId,
      appointmentDate,
      durationMinutes
    )

    return {
      success: true,
      data: slots,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get available slots',
    }
  }
}
