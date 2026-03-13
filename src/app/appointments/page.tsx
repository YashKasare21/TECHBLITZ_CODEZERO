import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getAppointments } from '@/app/actions/appointments'
import { getDoctors } from '@/app/actions/doctors'
import { getProfile } from '@/app/actions/profile'
import { AppointmentStatus, UserRole } from '@/types'

/**
 * Appointments page - Server Component
 * Accepts searchParams for filtering and passes data to client component
 */
interface AppointmentsPageProps {
  searchParams: {
    status?: AppointmentStatus
    date?: string
    doctorId?: string
  }
}

export default async function AppointmentsPage({
  searchParams,
}: AppointmentsPageProps) {
  // Get current user profile for role-based filtering
  const profileResult = await getProfile()

  if (!profileResult.success || !profileResult.data) {
    redirect('/login')
  }

  const profile = profileResult.data
  const role = profile.role as UserRole

  // Build filters from searchParams
  const filters: {
    status?: AppointmentStatus
    date?: string
    doctorId?: string
    patientId?: string
  } = {}

  if (searchParams.status) {
    filters.status = searchParams.status
  }

  if (searchParams.date) {
    filters.date = searchParams.date
  }

  // Role-based filtering
  if (role === 'doctor') {
    // Doctors only see their own appointments
    const doctorsResult = await getDoctors()
    const doctor = doctorsResult.success
      ? doctorsResult.data?.find((d) => d.profile_id === profile.id)
      : null
    if (doctor) {
      filters.doctorId = doctor.id
    }
  } else if (role === 'patient') {
    // Patients only see their own appointments
    const { getPatients } = await import('@/app/actions/patients')
    const patientsResult = await getPatients()
    const patient = patientsResult.success
      ? patientsResult.data?.find((p) => p.profile_id === profile.id)
      : null
    if (patient) {
      filters.patientId = patient.id
    }
  } else if (searchParams.doctorId) {
    // Admin/receptionist can filter by any doctor
    filters.doctorId = searchParams.doctorId
  }

  // Fetch appointments and doctors (for filter dropdown)
  const [appointmentsResult, doctorsResult] = await Promise.all([
    getAppointments(filters),
    getDoctors(),
  ])

  const appointments = appointmentsResult.success
    ? appointmentsResult.data || []
    : []
  const doctors = doctorsResult.success ? doctorsResult.data || [] : []

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Appointments</h1>
        {role !== 'patient' && (
          <a
            href="/appointments/new"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            New Appointment
          </a>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <form className="flex flex-wrap gap-4">
          {/* Status filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              name="status"
              defaultValue={searchParams.status || ''}
              className="border rounded px-3 py-2"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked_in">Checked In</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Date filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              name="date"
              defaultValue={searchParams.date || ''}
              className="border rounded px-3 py-2"
            />
          </div>

          {/* Doctor filter (admin/receptionist only) */}
          {role !== 'doctor' && role !== 'patient' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Doctor
              </label>
              <select
                name="doctorId"
                defaultValue={searchParams.doctorId || ''}
                className="border rounded px-3 py-2"
              >
                <option value="">All Doctors</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    Dr. {doctor.profile?.last_name || 'Unknown'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-end">
            <button
              type="submit"
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-lg shadow">
        {appointments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No appointments found
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4">Date & Time</th>
                {role !== 'patient' && <th className="text-left p-4">Patient</th>}
                {role !== 'doctor' && <th className="text-left p-4">Doctor</th>}
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => (
                <tr key={appointment.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">
                    <div className="font-medium">
                      {appointment.appointment_date}
                    </div>
                    <div className="text-sm text-gray-500">
                      {appointment.start_time} - {appointment.end_time}
                    </div>
                  </td>
                  {role !== 'patient' && (
                    <td className="p-4">
                      {appointment.patient?.profile?.first_name}{' '}
                      {appointment.patient?.profile?.last_name}
                    </td>
                  )}
                  {role !== 'doctor' && (
                    <td className="p-4">
                      Dr. {appointment.doctor?.profile?.last_name}
                    </td>
                  )}
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        appointment.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : appointment.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : appointment.status === 'checked_in'
                              ? 'bg-blue-100 text-blue-800'
                              : appointment.status === 'completed'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {appointment.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <a
                      href={`/appointments/${appointment.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
