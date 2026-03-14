'use client';

import { useEffect, useState } from 'react';
import { format, isToday } from 'date-fns';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import AppointmentCard from '@/components/AppointmentCard';
import AppointmentModal from '@/components/AppointmentModal';
import { useAppointments } from '@/hooks/useAppointments';
import { Appointment } from '@/types';
import dynamic from 'next/dynamic';

const ClinicCalendar = dynamic(() => import('@/components/Calendar'), { ssr: false });

const RECEPTIONIST_ROLES = ['RECEPTIONIST'] as const;

export default function ReceptionistDashboard() {
  return (
    <ProtectedRoute allowedRoles={RECEPTIONIST_ROLES}>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { appointments, fetchAppointments, createAppointment, updateAppointment, cancelAppointment } =
    useAppointments();

  const [modalOpen, setModalOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [prefillStart, setPrefillStart] = useState<Date | null>(null);
  const [prefillEnd, setPrefillEnd] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'today' | 'calendar'>('today');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const todayAppointments = appointments
    .filter((a) => isToday(new Date(a.startTime)))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const stats = {
    total: todayAppointments.length,
    scheduled: todayAppointments.filter((a) => a.status === 'SCHEDULED').length,
    completed: todayAppointments.filter((a) => a.status === 'COMPLETED').length,
    cancelled: todayAppointments.filter((a) => a.status === 'CANCELLED').length,
  };

  const handleBook = async (data: {
    patientId: string;
    doctorId: string;
    startTime: string;
    duration: number;
    notes?: string;
  }) => {
    if (rescheduleTarget) {
      await updateAppointment(rescheduleTarget.id, {
        startTime: data.startTime,
        duration: data.duration,
        notes: data.notes,
      });
      showToast('Appointment rescheduled');
    } else {
      await createAppointment(data);
      showToast('Appointment booked');
    }
    setRescheduleTarget(null);
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this appointment?')) return;
    await cancelAppointment(id);
    showToast('Appointment cancelled');
  };

  const handleReschedule = (appt: Appointment) => {
    setRescheduleTarget(appt);
    setModalOpen(true);
  };

  const handleCalendarSelect = (start: Date, end: Date) => {
    setPrefillStart(start);
    setPrefillEnd(end);
    setRescheduleTarget(null);
    setModalOpen(true);
  };

  const handleEventDrop = async (id: string, newStart: Date, newEnd: Date) => {
    const duration = Math.round((newEnd.getTime() - newStart.getTime()) / 60000);
    try {
      await updateAppointment(id, { startTime: newStart.toISOString(), duration });
      showToast('Appointment moved');
    } catch {
      showToast('Could not reschedule — slot unavailable', 'error');
      fetchAppointments();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reception Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <button
            onClick={() => { setRescheduleTarget(null); setPrefillStart(null); setPrefillEnd(null); setModalOpen(true); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Book Appointment
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Today's Total", value: stats.total, color: 'text-gray-900 dark:text-white', bg: 'bg-white dark:bg-gray-800' },
            { label: 'Scheduled', value: stats.scheduled, color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' },
            { label: 'Completed', value: stats.completed, color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30' },
            { label: 'Cancelled', value: stats.cancelled, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-gray-100 dark:border-gray-700`}>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
          {(['today', 'calendar'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}>
              {tab === 'today' ? "Today's Appointments" : 'Calendar View'}
            </button>
          ))}
        </div>

        {activeTab === 'today' ? (
          <div>
            {todayAppointments.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-600 dark:text-gray-400 font-medium">No appointments today</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">Click &ldquo;Book Appointment&rdquo; to schedule one</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {todayAppointments.map((appt) => (
                  <AppointmentCard
                    key={appt.id}
                    appointment={appt}
                    onCancel={handleCancel}
                    onReschedule={handleReschedule}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
            <ClinicCalendar
              appointments={appointments}
              editable
              onDateSelect={handleCalendarSelect}
              onEventClick={(evt) => {
                if (evt.extendedProps.type === 'appointment') {
                  const appt = appointments.find((a) => a.id === evt.id);
                  if (appt && appt.status === 'SCHEDULED') handleReschedule(appt);
                }
              }}
              onEventDrop={handleEventDrop}
            />
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
              {[
                { color: '#3B82F6', label: 'Scheduled' },
                { color: '#22C55E', label: 'Completed' },
                { color: '#9CA3AF', label: 'Cancelled' },
                { color: '#EF4444', label: 'Blocked' },
              ].map((item) => (
                <span key={item.label} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <AppointmentModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setRescheduleTarget(null); setPrefillStart(null); setPrefillEnd(null); }}
        onSubmit={handleBook}
        rescheduleTarget={rescheduleTarget}
        prefillStart={prefillStart}
        prefillEnd={prefillEnd}
      />
    </div>
  );
}
