/**
 * Appointment Slot Generation Algorithm
 * 
 * Determines available booking slots by checking:
 * - Doctor session availability for the day
 * - Existing appointments (excluding cancelled/no_show)
 * - Doctor holidays
 * - Past time slots (if date is today)
 */

import { BookingSlot, DayOfWeek } from '@/types'
import { createClient } from '@/lib/supabase/server'

/**
 * Convert time string "HH:MM" to total minutes from midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Convert total minutes from midnight to time string "HH:MM"
 */
export function minutesToTime(mins: number): string {
  const hours = Math.floor(mins / 60)
  const minutes = mins % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/**
 * Check if two time ranges overlap
 * Range 1: [start1, end1]
 * Range 2: [start2, end2]
 */
function rangesOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return start1 < end2 && start2 < end1
}

/**
 * Check if a slot falls within a holiday period
 */
function isSlotInHoliday(
  slotStart: number,
  slotEnd: number,
  holiday: {
    is_full_day: boolean
    start_time: string | null
    end_time: string | null
  }
): boolean {
  // Full day holiday blocks everything
  if (holiday.is_full_day) {
    return true
  }

  // Partial holiday - check time overlap
  if (holiday.start_time && holiday.end_time) {
    const holidayStart = timeToMinutes(holiday.start_time)
    const holidayEnd = timeToMinutes(holiday.end_time)
    return rangesOverlap(slotStart, slotEnd, holidayStart, holidayEnd)
  }

  return false
}

/**
 * Check if a slot overlaps with any existing appointment
 */
function isSlotBooked(
  slotStart: number,
  slotEnd: number,
  appointments: Array<{ start_time: string; end_time: string }>
): boolean {
  return appointments.some((apt) => {
    const aptStart = timeToMinutes(apt.start_time)
    const aptEnd = timeToMinutes(apt.end_time)
    return rangesOverlap(slotStart, slotEnd, aptStart, aptEnd)
  })
}

/**
 * Check if a slot is in the past (for today's date)
 */
function isSlotInPast(slotStart: number, date: Date): boolean {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  // If checking a future date, slot is not in past
  if (checkDate > today) {
    return false
  }

  // If checking a past date, all slots are in past
  if (checkDate < today) {
    return true
  }

  // Checking today - compare with current time
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  return slotStart <= currentMinutes
}

/**
 * Generate all possible slots within a session
 */
function generateSlotsInSession(
  sessionStart: number,
  sessionEnd: number,
  durationMinutes: number,
  date: Date,
  appointments: Array<{ start_time: string; end_time: string }>,
  holidays: Array<{ is_full_day: boolean; start_time: string | null; end_time: string | null }>
): BookingSlot[] {
  const slots: BookingSlot[] = []
  const dateString = date.toISOString().split('T')[0] // YYYY-MM-DD

  // Generate slots starting every durationMinutes
  for (let start = sessionStart; start + durationMinutes <= sessionEnd; start += durationMinutes) {
    const end = start + durationMinutes

    // Check if slot is in the past
    if (isSlotInPast(start, date)) {
      slots.push({
        date: dateString,
        startTime: minutesToTime(start),
        endTime: minutesToTime(end),
        isAvailable: false,
      })
      continue
    }

    // Check if slot overlaps with any holiday
    const blockedByHoliday = holidays.some((holiday) =>
      isSlotInHoliday(start, end, holiday)
    )

    if (blockedByHoliday) {
      slots.push({
        date: dateString,
        startTime: minutesToTime(start),
        endTime: minutesToTime(end),
        isAvailable: false,
      })
      continue
    }

    // Check if slot is already booked
    const isBooked = isSlotBooked(start, end, appointments)

    slots.push({
      date: dateString,
      startTime: minutesToTime(start),
      endTime: minutesToTime(end),
      isAvailable: !isBooked,
    })
  }

  return slots
}

/**
 * Get available booking slots for a doctor on a specific date
 * 
 * @param doctorId - The doctor's UUID
 * @param date - The date to check for slots
 * @param durationMinutes - Duration of each appointment slot
 * @returns Array of BookingSlot objects
 */
export async function getAvailableSlots(
  doctorId: string,
  date: Date,
  durationMinutes: number
): Promise<BookingSlot[]> {
  const supabase = await createClient()

  // Step 1: Get doctor session for the given day of week
  const dayOfWeek = date.getDay() as DayOfWeek
  const { data: session, error: sessionError } = await supabase
    .from('doctor_sessions')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('day_of_week', dayOfWeek)
    .single()

  if (sessionError || !session) {
    // No session found for this day
    return []
  }

  const sessionData = session as {
    start_time: string
    end_time: string
    is_available: boolean
  }

  // Step 2: Check if session is available
  if (!sessionData.is_available) {
    return []
  }

  // Step 3: Get existing appointments for this doctor on this date
  // Exclude cancelled and no_show appointments
  const dateString = date.toISOString().split('T')[0] // YYYY-MM-DD
  const { data: appointments, error: appointmentsError } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('doctor_id', doctorId)
    .eq('appointment_date', dateString)
    .not('status', 'in', '("cancelled","no_show")')

  if (appointmentsError) {
    console.error('Error fetching appointments:', appointmentsError)
    return []
  }

  // Step 4: Get holidays for this doctor on this date
  const { data: holidays, error: holidaysError } = await supabase
    .from('holidays')
    .select('is_full_day, start_time, end_time')
    .eq('doctor_id', doctorId)
    .eq('holiday_date', dateString)

  if (holidaysError) {
    console.error('Error fetching holidays:', holidaysError)
    return []
  }

  // Step 5 & 6: Generate slots and check availability
  const sessionStart = timeToMinutes(sessionData.start_time)
  const sessionEnd = timeToMinutes(sessionData.end_time)

  const slots = generateSlotsInSession(
    sessionStart,
    sessionEnd,
    durationMinutes,
    date,
    (appointments || []) as Array<{ start_time: string; end_time: string }>,
    (holidays || []) as Array<{ is_full_day: boolean; start_time: string | null; end_time: string | null }>
  )

  // Step 7: Return array of BookingSlot objects
  return slots
}
