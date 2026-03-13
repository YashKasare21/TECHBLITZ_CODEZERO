import { redirect } from 'next/navigation'
import { getDoctors } from '@/app/actions/doctors'
import { getServices } from '@/app/actions/services'
import { getProfile } from '@/app/actions/profile'
import { getPatients } from '@/app/actions/patients'
import BookingForm from '@/components/BookingForm'

/**
 * New Appointment page - Server Component wrapper
 * Fetches data and passes as props to BookingForm client component
 */
export default async function NewAppointmentPage() {
  // Get current user profile for role-based access
  const profileResult = await getProfile()

  if (!profileResult.success || !profileResult.data) {
    redirect('/login')
  }

  const profile = profileResult.data
  const role = profile.role

  // Patients shouldn't access this page directly
  if (role === 'patient') {
    redirect('/appointments')
  }

  // Fetch doctors and services for the form
  const [doctorsResult, servicesResult, patientsResult] = await Promise.all([
    getDoctors(),
    getServices(),
    getPatients(),
  ])

  const doctors = doctorsResult.success ? doctorsResult.data || [] : []
  const services = servicesResult.success ? servicesResult.data || [] : []
  const patients = patientsResult.success ? patientsResult.data || [] : []

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">New Appointment</h1>

      <BookingForm
        doctors={doctors}
        services={services}
        patients={patients}
        currentUserId={profile.id}
      />
    </div>
  )
}
