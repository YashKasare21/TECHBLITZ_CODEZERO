import { redirect } from 'next/navigation'
import { getProfile } from '@/app/actions/profile'
import { getAppointments } from '@/app/actions/appointments'
import { getDoctors, getDoctorByProfileId } from '@/app/actions/doctors'
import { getPatients, getPatientByProfileId } from '@/app/actions/patients'
import { UserRole } from '@/types'

/**
 * Dashboard page - Server Component
 * Fetches role-based data and passes to client components
 */
export default async function DashboardPage() {
  // Get current user profile
  const profileResult = await getProfile()

  if (!profileResult.success || !profileResult.data) {
    redirect('/login')
  }

  const profile = profileResult.data
  const role = profile.role as UserRole

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0]

  // Fetch role-specific data
  let dashboardData = {
    profile,
    role,
    stats: {} as Record<string, number>,
    appointments: [] as unknown[],
    nextAppointment: null as unknown,
  }

  switch (role) {
    case 'admin':
      // Admin sees overview of everything
      const [todayAppointments, allDoctors, allPatients] = await Promise.all([
        getAppointments({ date: today }),
        getDoctors(),
        getPatients(),
      ])

      const recentAppointments = await getAppointments({
        dateFrom: today,
      })

      dashboardData = {
        ...dashboardData,
        stats: {
          todayAppointments: todayAppointments.success
            ? todayAppointments.data?.length || 0
            : 0,
          totalDoctors: allDoctors.success ? allDoctors.data?.length || 0 : 0,
          totalPatients: allPatients.success
            ? allPatients.data?.length || 0
            : 0,
        },
        appointments: recentAppointments.success
          ? recentAppointments.data?.slice(0, 10) || []
          : [],
      }
      break

    case 'doctor':
      // Doctor sees their own appointments
      const doctorResult = await getDoctorByProfileId(profile.id)
      const doctor = doctorResult.success ? doctorResult.data : null

      if (doctor) {
        const [doctorTodayAppointments, doctorUpcoming] = await Promise.all([
          getAppointments({ doctorId: doctor.id, date: today }),
          getAppointments({
            doctorId: doctor.id,
            dateFrom: today,
            status: 'confirmed',
          }),
        ])

        const upcoming = doctorUpcoming.success
          ? doctorUpcoming.data?.filter(
              (apt) => apt.appointment_date >= today
            ) || []
          : []

        dashboardData = {
          ...dashboardData,
          stats: {
            todayAppointments: doctorTodayAppointments.success
              ? doctorTodayAppointments.data?.length || 0
              : 0,
          },
          appointments: doctorTodayAppointments.success
            ? doctorTodayAppointments.data || []
            : [],
          nextAppointment: upcoming.length > 0 ? upcoming[0] : null,
        }
      }
      break

    case 'receptionist':
      // Receptionist sees all today's appointments and pending
      const [receptionistTodayAppointments, pendingAppointments] =
        await Promise.all([
          getAppointments({ date: today }),
          getAppointments({ status: 'pending' }),
        ])

      dashboardData = {
        ...dashboardData,
        stats: {
          todayAppointments: receptionistTodayAppointments.success
            ? receptionistTodayAppointments.data?.length || 0
            : 0,
          pendingConfirmations: pendingAppointments.success
            ? pendingAppointments.data?.length || 0
            : 0,
        },
        appointments: receptionistTodayAppointments.success
          ? receptionistTodayAppointments.data || []
          : [],
      }
      break

    case 'patient':
      // Patient sees their own appointments
      const patientResult = await getPatientByProfileId(profile.id)
      const patient = patientResult.success ? patientResult.data : null

      if (patient) {
        const [upcomingAppointments, pastAppointments] = await Promise.all([
          getAppointments({
            patientId: patient.id,
            dateFrom: today,
          }),
          getAppointments({
            patientId: patient.id,
            dateTo: today,
          }),
        ])

        dashboardData = {
          ...dashboardData,
          stats: {
            upcomingAppointments: upcomingAppointments.success
              ? upcomingAppointments.data?.length || 0
              : 0,
            pastAppointments: pastAppointments.success
              ? pastAppointments.data?.length || 0
              : 0,
          },
          appointments: upcomingAppointments.success
            ? upcomingAppointments.data || []
            : [],
        }
      }
      break
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        Welcome, {profile.first_name || profile.role}
      </h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Object.entries(dashboardData.stats).map(([key, value]) => (
          <div key={key} className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm text-gray-500 capitalize">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </h3>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold p-4 border-b">
          {role === 'patient' ? 'Upcoming Appointments' : "Today's Appointments"}
        </h2>
        <div className="p-4">
          {dashboardData.appointments.length === 0 ? (
            <p className="text-gray-500">No appointments found</p>
          ) : (
            <ul className="space-y-3">
              {dashboardData.appointments.map((apt: unknown) => {
                const appointment = apt as {
                  id: string
                  appointment_date: string
                  start_time: string
                  status: string
                  doctor?: { profile?: { first_name?: string; last_name?: string } }
                  patient?: { profile?: { first_name?: string; last_name?: string } }
                }
                return (
                  <li
                    key={appointment.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded"
                  >
                    <div>
                      <p className="font-medium">
                        {appointment.appointment_date} at {appointment.start_time}
                      </p>
                      <p className="text-sm text-gray-500">
                        {role === 'doctor' || role === 'receptionist'
                          ? `Patient: ${appointment.patient?.profile?.first_name || ''} ${appointment.patient?.profile?.last_name || ''}`
                          : `Doctor: ${appointment.doctor?.profile?.first_name || ''} ${appointment.doctor?.profile?.last_name || ''}`}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        appointment.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : appointment.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {appointment.status}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
