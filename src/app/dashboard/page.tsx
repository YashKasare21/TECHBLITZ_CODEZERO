import { getProfile } from '@/app/actions/profile'
import { getAppointments } from '@/app/actions/appointments'
import { getDoctors } from '@/app/actions/doctors'
import { getPatients } from '@/app/actions/patients'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Stethoscope, Users, Clock, LogOut } from 'lucide-react'
import { signOut } from '@/app/actions/auth'

export default async function AdminDashboardPage() {
  const profileResult = await getProfile()
  if (!profileResult.success || !profileResult.data) redirect('/login')
  const profile = profileResult.data
  
  const today = new Date().toISOString().split('T')[0]
  const [todayApts, allDoctors, allPatients, recentApts] = await Promise.all([
    getAppointments({ date: today }),
    getDoctors(),
    getPatients(),
    getAppointments({ dateFrom: today }),
  ])

  const pendingApprovalsCount = (recentApts.data || []).filter(apt => (apt as any).status === 'pending').length

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
        return <span className="rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800">{status}</span>
    }
  }

  const initials = profile.first_name ? profile.first_name.charAt(0).toUpperCase() : 'A'

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 1. Top navbar */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <div className="bg-[#E1F5EE] p-2 rounded-lg mr-3">
              <Stethoscope className="w-5 h-5 text-[#1D9E75]" />
            </div>
            <span className="text-xl font-bold text-gray-900">Clinic OS</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{profile.first_name} {profile.last_name}</p>
                <p className="text-xs text-gray-500 capitalize">{profile.role}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-[#1D9E75] flex items-center justify-center text-white font-bold shadow-sm">
                {initials}
              </div>
            </div>
            <form action={async () => { "use server"; await signOut() }}>
              <button type="submit" className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Content area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        
        {/* 2. Page title */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">{formattedDate}</p>
        </div>

        {/* 3. Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center">
            <div className="bg-[#E1F5EE] p-3 rounded-xl mr-4">
              <Calendar className="w-6 h-6 text-[#1D9E75]" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Today's Appointments</p>
              <p className="text-2xl font-semibold text-gray-900">{todayApts.data?.length || 0}</p>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center">
            <div className="bg-blue-50 p-3 rounded-xl mr-4">
              <Stethoscope className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Doctors</p>
              <p className="text-2xl font-semibold text-gray-900">{allDoctors.data?.length || 0}</p>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center">
            <div className="bg-purple-50 p-3 rounded-xl mr-4">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Patients</p>
              <p className="text-2xl font-semibold text-gray-900">{allPatients.data?.length || 0}</p>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center">
            <div className="bg-orange-50 p-3 rounded-xl mr-4">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Pending Approvals</p>
              <p className="text-2xl font-semibold text-gray-900">{pendingApprovalsCount}</p>
            </div>
          </div>
        </div>

        {/* 4. Two-column section */}
        <div className="flex flex-col lg:flex-row gap-8 mb-8">
          
          {/* Appointments table (2/3) */}
          <div className="lg:w-2/3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden h-full flex flex-col">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Today's Appointments</h2>
                <Link href="/appointments" className="text-sm font-medium text-[#1D9E75] hover:text-[#0F6E56]">
                  View all
                </Link>
              </div>
              
              <div className="p-0 flex-1 flex flex-col">
                {(!todayApts.data || todayApts.data.length === 0) ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                    <div className="bg-gray-50 p-4 rounded-full mb-4">
                      <Calendar className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-base font-medium text-gray-900 mb-1">No appointments today</h3>
                    <p className="text-sm text-gray-500">There are no appointments scheduled for today.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-4 font-medium">Time</th>
                          <th className="px-6 py-4 font-medium">Patient</th>
                          <th className="px-6 py-4 font-medium">Doctor</th>
                          <th className="px-6 py-4 font-medium">Type</th>
                          <th className="px-6 py-4 font-medium">Status</th>
                          <th className="px-6 py-4 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {todayApts.data.slice(0, 8).map((apt: any) => (
                          <tr key={apt.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">{apt.start_time.substring(0, 5)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                              {apt.patient?.profile?.first_name} {apt.patient?.profile?.last_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                              Dr. {apt.doctor?.profile?.last_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                              {apt.service?.name || 'General Visit'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(apt.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Link href={`/appointments/${apt.id}`} className="text-[#1D9E75] hover:text-[#0F6E56]">
                                View
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions Panel (1/3) */}
          <div className="lg:w-1/3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 h-full">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h2>
              <div className="space-y-4">
                <Link href="/appointments/new" className="flex items-center w-full p-4 rounded-xl border border-gray-100 hover:border-[#1D9E75] hover:bg-[#E1F5EE] transition-all group">
                  <div className="bg-gray-50 group-hover:bg-white p-2 rounded-lg mr-4 transition-colors">
                    <Calendar className="w-5 h-5 text-gray-600 group-hover:text-[#1D9E75]" />
                  </div>
                  <div className="font-medium text-gray-900">New Appointment</div>
                </Link>
                
                <Link href="/patients/new" className="flex items-center w-full p-4 rounded-xl border border-gray-100 hover:border-[#1D9E75] hover:bg-[#E1F5EE] transition-all group">
                  <div className="bg-gray-50 group-hover:bg-white p-2 rounded-lg mr-4 transition-colors">
                    <Users className="w-5 h-5 text-gray-600 group-hover:text-[#1D9E75]" />
                  </div>
                  <div className="font-medium text-gray-900">Add Patient</div>
                </Link>
                
                <Link href="/schedule" className="flex items-center w-full p-4 rounded-xl border border-gray-100 hover:border-[#1D9E75] hover:bg-[#E1F5EE] transition-all group">
                  <div className="bg-gray-50 group-hover:bg-white p-2 rounded-lg mr-4 transition-colors">
                    <Clock className="w-5 h-5 text-gray-600 group-hover:text-[#1D9E75]" />
                  </div>
                  <div className="font-medium text-gray-900">View Schedule</div>
                </Link>
                
                <Link href="/doctors" className="flex items-center w-full p-4 rounded-xl border border-gray-100 hover:border-[#1D9E75] hover:bg-[#E1F5EE] transition-all group">
                  <div className="bg-gray-50 group-hover:bg-white p-2 rounded-lg mr-4 transition-colors">
                    <Stethoscope className="w-5 h-5 text-gray-600 group-hover:text-[#1D9E75]" />
                  </div>
                  <div className="font-medium text-gray-900">Manage Doctors</div>
                </Link>
              </div>
            </div>
          </div>
          
        </div>

        {/* 5. Recent activity feed */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Recent Activity</h2>
          <div className="space-y-6">
            {(!recentApts.data || recentApts.data.length === 0) ? (
              <p className="text-sm text-gray-500">No recent activity.</p>
            ) : (
              recentApts.data.slice(0, 5).map((apt: any) => (
                <div key={`activity-${apt.id}`} className="flex items-start">
                  <div className="bg-[#E1F5EE] rounded-full p-2 mr-4 flex-shrink-0 mt-0.5">
                    <Calendar className="w-4 h-4 text-[#1D9E75]" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">Appointment {apt.status}</span> for {apt.patient?.profile?.first_name} {apt.patient?.profile?.last_name} with Dr. {apt.doctor?.profile?.last_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(apt.created_at || apt.appointment_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </main>
    </div>
  )
}
