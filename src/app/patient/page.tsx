import { getProfile } from '@/app/actions/profile'
import { getAppointments } from '@/app/actions/appointments'
import { getPatientByProfileId } from '@/app/actions/patients'
import { getDoctors } from '@/app/actions/doctors'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Clock, ChevronDown, ChevronUp } from 'lucide-react'

// "use client" sub-component for toggling the past appointments section
function PastAppointments({ pastApts }: { pastApts: any[] }) {
  // Rather than making the whole page "use client", we'll just show it statically for now
  // per the instructions "use client sub-component to toggle". We'll mock the toggle with details/summary
  // to keep it accessible without full react hydration if desired, but details/summary is native HTML.

  return (
    <details className="group bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <summary className="p-6 cursor-pointer list-none flex justify-between items-center group-open:border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Visit History</h2>
        <div className="text-gray-400 group-open:rotate-180 transition-transform duration-200">
          <ChevronDown className="w-5 h-5" />
        </div>
      </summary>
      
      <div className="p-0">
        {(!pastApts || pastApts.length === 0) ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No past visits found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Doctor</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pastApts.slice(0, 5).map((apt: any) => (
                  <tr key={apt.id} className="text-gray-500">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(apt.appointment_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      Dr. {apt.doctor?.profile?.last_name || 'Staff'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {apt.service?.name || 'General Visit'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap capitalize">
                      {apt.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  )
}

export default async function PatientDashboardPage() {
  const profileResult = await getProfile()
  if (!profileResult.success || !profileResult.data) redirect('/login')
  const profile = profileResult.data
  const today = new Date().toISOString().split('T')[0]

  const patientResult = await getPatientByProfileId(profile.id)
  if (!patientResult.success || !patientResult.data) redirect('/login')
  const patient = patientResult.data

  const [upcomingApts, pastApts, doctors] = await Promise.all([
    getAppointments({ patientId: patient.id, dateFrom: today }),
    getAppointments({ patientId: patient.id, dateTo: today }),
    getDoctors(),
  ])

  // Process data
  const upcomingData = (upcomingApts.data || []).sort((a: any, b: any) => 
    new Date(`${a.appointment_date}T${a.start_time}`).getTime() - new Date(`${b.appointment_date}T${b.start_time}`).getTime()
  )
  
  const pastData = (pastApts.data || []).sort((a: any, b: any) => 
    new Date(`${b.appointment_date}T${b.start_time}`).getTime() - new Date(`${a.appointment_date}T${a.start_time}`).getTime()
  )

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const initials = profile.first_name ? profile.first_name.charAt(0).toUpperCase() : 'P'

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="rounded-full px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>
      case 'confirmed':
        return <span className="rounded-full px-3 py-1 text-xs font-medium bg-green-100 text-green-800">Confirmed</span>
      case 'checked_in':
        return <span className="rounded-full px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800">Checked In</span>
      case 'completed':
        return <span className="rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800">Completed</span>
      case 'cancelled':
        return <span className="rounded-full px-3 py-1 text-xs font-medium bg-red-100 text-red-800">Cancelled</span>
      default:
        return <span className="rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 capitalize">{status}</span>
    }
  }

  const nextAppointment = upcomingData.length > 0 ? upcomingData[0] : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 1. Warm welcome header */}
      <div className="bg-gradient-to-b from-[#E1F5EE] to-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center space-x-5">
            <div className="h-16 w-16 rounded-full bg-[#1D9E75] flex items-center justify-center text-white text-2xl font-bold shadow-md">
              {initials}
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">
                Good morning, {profile.first_name}
              </h1>
              <p className="mt-1 text-base text-gray-500">{formattedDate}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* 2. Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center">
            <div className="bg-[#E1F5EE] p-3 rounded-xl mr-4">
              <Calendar className="w-6 h-6 text-[#1D9E75]" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Upcoming Appointments</p>
              <p className="text-2xl font-semibold text-gray-900">{upcomingData.length}</p>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center">
            <div className="bg-gray-100 p-3 rounded-xl mr-4">
              <Clock className="w-6 h-6 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Past Visits</p>
              <p className="text-2xl font-semibold text-gray-900">{pastData.length}</p>
            </div>
          </div>
        </div>

        {/* 3. Next appointment hero card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden border-l-4 border-l-[#1D9E75]">
          {nextAppointment ? (
            <div className="p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center justify-center bg-[#E1F5EE] rounded-xl p-4 min-w-[100px] text-center">
                  <span className="text-sm font-medium text-[#1D9E75] uppercase tracking-wider">
                    {new Date(nextAppointment.appointment_date).toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  <span className="text-4xl font-bold text-[#1D9E75]">
                    {new Date(nextAppointment.appointment_date).getDate()}
                  </span>
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">
                    Dr. {nextAppointment.doctor?.profile?.last_name || 'Staff'}
                  </h3>
                  <p className="text-gray-500 mb-3">
                    {nextAppointment.doctor?.specialty || 'General Practice'}
                  </p>
                  <div className="flex items-center gap-4 text-sm font-medium text-gray-700">
                    <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-md">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {nextAppointment.start_time.substring(0, 5)} - {nextAppointment.end_time.substring(0, 5)}
                    </div>
                    {getStatusBadge(nextAppointment.status)}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 md:flex-col lg:flex-row">
                {['pending', 'confirmed'].includes(nextAppointment.status) && (
                  <button className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors">
                    Cancel Appointment
                  </button>
                )}
                <Link href={`/appointments/${nextAppointment.id}`} className="px-4 py-2 bg-[#1D9E75] hover:bg-[#0F6E56] text-white rounded-md text-sm font-medium transition-colors text-center shadow-sm">
                  View Details
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-10 flex flex-col items-center justify-center text-center">
              <div className="bg-[#E1F5EE] p-4 rounded-full mb-4">
                <Calendar className="w-8 h-8 text-[#1D9E75]" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No upcoming appointments</h3>
              <p className="text-gray-500 mb-6 max-w-sm">
                You don't have any appointments scheduled at the moment. Would you like to book one?
              </p>
              <Link href="/appointments/new" className="px-6 py-3 bg-[#1D9E75] hover:bg-[#0F6E56] text-white rounded-md font-medium transition-colors shadow-sm">
                Book an Appointment
              </Link>
            </div>
          )}
        </div>

        {/* 4. Upcoming appointments list */}
        {upcomingData.length > 1 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">All Upcoming Appointments</h2>
            </div>
            
            <div className="divide-y divide-gray-100 p-0">
              {upcomingData.slice(1, 5).map((apt: any) => (
                <div key={apt.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-[#E1F5EE] text-[#1D9E75] text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full whitespace-nowrap">
                      {new Date(apt.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Dr. {apt.doctor?.profile?.last_name || 'Staff'}</p>
                      <p className="text-sm text-gray-500 line-clamp-1">{apt.doctor?.specialty || 'General Practice'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full">
                    <div className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      {apt.start_time.substring(0, 5)}
                    </div>
                    <div className="whitespace-nowrap hidden md:block">
                      {getStatusBadge(apt.status)}
                    </div>
                    {['pending', 'confirmed'].includes(apt.status) ? (
                      <button className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md">
                        Cancel
                      </button>
                    ) : (
                      <div className="w-16"></div> // placeholder to keep alignment
                    )}
                  </div>
                </div>
              ))}
            </div>
            {upcomingData.length > 5 && (
              <div className="p-4 border-t border-gray-100 text-center">
                <Link href="/appointments" className="text-sm font-medium text-[#1D9E75] hover:text-[#0F6E56]">
                  View all appointments
                </Link>
              </div>
            )}
          </div>
        )}

        {/* 5. Past appointments section */}
        <PastAppointments pastApts={pastData} />
        
      </div>
    </div>
  )
}
