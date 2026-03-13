'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAppointment } from '@/app/actions/appointments'
import { DoctorWithProfile, PatientWithProfile, Service } from '@/types'

interface BookingFormProps {
  doctors: DoctorWithProfile[]
  services: Service[]
  patients: PatientWithProfile[]
  currentUserId: string
}

/**
 * BookingForm - Client Component
 * Handles appointment creation with form state and server action calls
 */
export default function BookingForm({
  doctors,
  services,
  patients,
  currentUserId,
}: BookingFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true)
    setError(null)

    const doctorId = formData.get('doctorId') as string
    const patientId = formData.get('patientId') as string
    const date = formData.get('date') as string
    const timeSlot = formData.get('timeSlot') as string
    const visitType = formData.get('visitType') as string
    const serviceId = formData.get('serviceId') as string
    const description = formData.get('description') as string

    // Parse time slot
    const [startTime, endTime] = timeSlot.split('-')

    const result = await createAppointment({
      doctor_id: doctorId,
      patient_id: patientId,
      appointment_date: date,
      start_time: startTime,
      end_time: endTime || startTime,
      visit_type: visitType as
        | 'consultation'
        | 'follow_up'
        | 'routine_checkup'
        | 'emergency',
      description: description || undefined,
    })

    if (result.success) {
      router.push('/appointments')
      router.refresh()
    } else {
      setError(result.error || 'Failed to create appointment')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
      )}

      <form action={handleSubmit} className="space-y-4">
        {/* Patient Select */}
        <div>
          <label
            htmlFor="patientId"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Patient *
          </label>
          <select
            id="patientId"
            name="patientId"
            required
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select a patient</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.profile?.first_name} {patient.profile?.last_name} -{' '}
                {patient.profile?.phone || 'No phone'}
              </option>
            ))}
          </select>
        </div>

        {/* Doctor Select */}
        <div>
          <label
            htmlFor="doctorId"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Doctor *
          </label>
          <select
            id="doctorId"
            name="doctorId"
            required
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select a doctor</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                Dr. {doctor.profile?.last_name || 'Unknown'} -{' '}
                {doctor.specialty}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label
            htmlFor="date"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Date *
          </label>
          <input
            type="date"
            id="date"
            name="date"
            required
            min={new Date().toISOString().split('T')[0]}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        {/* Time Slot */}
        <div>
          <label
            htmlFor="timeSlot"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Time Slot *
          </label>
          <select
            id="timeSlot"
            name="timeSlot"
            required
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select a time slot</option>
            <option value="09:00-09:30">09:00 AM - 09:30 AM</option>
            <option value="09:30-10:00">09:30 AM - 10:00 AM</option>
            <option value="10:00-10:30">10:00 AM - 10:30 AM</option>
            <option value="10:30-11:00">10:30 AM - 11:00 AM</option>
            <option value="11:00-11:30">11:00 AM - 11:30 AM</option>
            <option value="11:30-12:00">11:30 AM - 12:00 PM</option>
            <option value="14:00-14:30">02:00 PM - 02:30 PM</option>
            <option value="14:30-15:00">02:30 PM - 03:00 PM</option>
            <option value="15:00-15:30">03:00 PM - 03:30 PM</option>
            <option value="15:30-16:00">03:30 PM - 04:00 PM</option>
            <option value="16:00-16:30">04:00 PM - 04:30 PM</option>
            <option value="16:30-17:00">04:30 PM - 05:00 PM</option>
          </select>
          <p className="text-sm text-gray-500 mt-1">
            Time slots would be dynamically fetched based on doctor availability
          </p>
        </div>

        {/* Visit Type */}
        <div>
          <label
            htmlFor="visitType"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Visit Type *
          </label>
          <select
            id="visitType"
            name="visitType"
            required
            className="w-full border rounded px-3 py-2"
          >
            <option value="consultation">Consultation</option>
            <option value="follow_up">Follow-up</option>
            <option value="routine_checkup">Routine Checkup</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>

        {/* Service Select */}
        <div>
          <label
            htmlFor="serviceId"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Service
          </label>
          <select
            id="serviceId"
            name="serviceId"
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select a service (optional)</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} - {service.duration_minutes}min - ${service.fee}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Notes
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            className="w-full border rounded px-3 py-2"
            placeholder="Any additional notes..."
          />
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Appointment'}
          </button>
          <a
            href="/appointments"
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded hover:bg-gray-200"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  )
}
