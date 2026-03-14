'use client';

import { useEffect, useState } from 'react';
import { format, startOfWeek, endOfWeek, addDays, isToday } from 'date-fns';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import AppointmentCard from '@/components/AppointmentCard';
import NoteModal from '@/components/NoteModal';
import { useAppointments } from '@/hooks/useAppointments';
import { doctorApi } from '@/services/api';
import { Appointment, BlockedSlot } from '@/types';
import axios from 'axios';
import dynamic from 'next/dynamic';

const ClinicCalendar = dynamic(() => import('@/components/Calendar'), { ssr: false });

const DOCTOR_ROLES = ['DOCTOR'] as const;

export default function DoctorDashboard() {
  return (
    <ProtectedRoute allowedRoles={DOCTOR_ROLES}>
      <DoctorContent />
    </ProtectedRoute>
  );
}

function DoctorContent() {
  const { appointments, fetchAppointments, updateAppointment } = useAppointments();
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [activeTab, setActiveTab] = useState<'today' | 'schedule' | 'block'>('today');
  const [noteModal, setNoteModal] = useState<{ open: boolean; appt: Appointment | null }>({
    open: false,
    appt: null,
  });
  const [blockForm, setBlockForm] = useState({ startTime: '', endTime: '', reason: '' });
  const [blockError, setBlockError] = useState('');
  const [blockSuccess, setBlockSuccess] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadSchedule = async () => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
    try {
      const res = await doctorApi.getSchedule(
        weekStart.toISOString(),
        weekEnd.toISOString(),
      );
      setBlockedSlots(res.data.data.blockedSlots);
    } catch { /* no-op */ }
  };

  useEffect(() => {
    fetchAppointments();
    loadSchedule();
  }, [fetchAppointments]);

  const todayAppointments = appointments
    .filter((a) => isToday(new Date(a.startTime)))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const upcomingAppointments = appointments
    .filter((a) => {
      const d = new Date(a.startTime);
      return d > new Date() && a.status === 'SCHEDULED';
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 10);

  const stats = {
    total: todayAppointments.length,
    remaining: todayAppointments.filter((a) => a.status === 'SCHEDULED').length,
    completed: todayAppointments.filter((a) => a.status === 'COMPLETED').length,
  };

  const handleComplete = async (id: string) => {
    await updateAppointment(id, { status: 'COMPLETED' });
    showToast('Marked as completed');
  };

  const handleSaveNote = async (note: string) => {
    if (!noteModal.appt) return;
    await updateAppointment(noteModal.appt.id, { notes: note });
    showToast('Note saved');
  };

  const handleBlockSlot = async () => {
    setBlockError('');
    setBlockSuccess('');
    if (!blockForm.startTime || !blockForm.endTime) {
      setBlockError('Start and end times are required');
      return;
    }
    try {
      const start = new Date(blockForm.startTime).toISOString();
      const end = new Date(blockForm.endTime).toISOString();
      await doctorApi.blockSlot({ startTime: start, endTime: end, reason: blockForm.reason || undefined });
      setBlockSuccess('Time slot blocked successfully');
      setBlockForm({ startTime: '', endTime: '', reason: '' });
      loadSchedule();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setBlockError(err.response?.data?.error || 'Failed to block slot');
      }
    }
  };

  const handleDeleteBlock = async (id: string) => {
    if (!confirm('Remove this blocked slot?')) return;
    await doctorApi.deleteBlockedSlot(id);
    setBlockedSlots((prev) => prev.filter((s) => s.id !== id));
    showToast('Blocked slot removed');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Doctor Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Today's Appointments", value: stats.total, color: 'text-gray-900 dark:text-white', bg: 'bg-white dark:bg-gray-800' },
            { label: 'Remaining', value: stats.remaining, color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' },
            { label: 'Completed', value: stats.completed, color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30' },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-gray-100 dark:border-gray-700`}>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit flex-wrap">
          {(['today', 'schedule', 'block'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}>
              {tab === 'today' ? "Today's List" : tab === 'schedule' ? 'Weekly Schedule' : 'Block Time'}
            </button>
          ))}
        </div>

        {/* Today tab */}
        {activeTab === 'today' && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {todayAppointments.length === 0 ? (
              <div className="col-span-3 text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                <p className="text-gray-600 dark:text-gray-400 font-medium">No appointments today</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">Enjoy your free day!</p>
              </div>
            ) : (
              todayAppointments.map((appt) => (
                <AppointmentCard
                  key={appt.id}
                  appointment={appt}
                  onComplete={handleComplete}
                  onAddNote={(a) => setNoteModal({ open: true, appt: a })}
                />
              ))
            )}
          </div>
        )}

        {/* Schedule tab */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
              <ClinicCalendar
                appointments={appointments}
                blockedSlots={blockedSlots}
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

            {upcomingAppointments.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">Upcoming Appointments</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {upcomingAppointments.map((appt) => (
                    <AppointmentCard
                      key={appt.id}
                      appointment={appt}
                      onComplete={handleComplete}
                      onAddNote={(a) => setNoteModal({ open: true, appt: a })}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Block Time tab */}
        {activeTab === 'block' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
              <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Block Time Slot</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Block a period to prevent appointment bookings (breaks, personal time, holidays).
              </p>

              {blockError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {blockError}
                </div>
              )}
              {blockSuccess && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
                  {blockSuccess}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Start Time</label>
                  <input
                    type="datetime-local"
                    value={blockForm.startTime}
                    onChange={(e) => setBlockForm((f) => ({ ...f, startTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">End Time</label>
                  <input
                    type="datetime-local"
                    value={blockForm.endTime}
                    onChange={(e) => setBlockForm((f) => ({ ...f, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Reason <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={blockForm.reason}
                    onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))}
                    placeholder="Lunch break, holiday, etc."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>
                <button onClick={handleBlockSlot}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-medium text-sm transition-colors">
                  Block This Time
                </button>
              </div>
            </div>

            {/* Existing blocks */}
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Blocked Slots</h2>
              {blockedSlots.length === 0 ? (
                <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No blocked slots</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {blockedSlots.map((slot) => (
                    <div key={slot.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{slot.reason || 'Blocked'}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          {format(new Date(slot.startTime), 'MMM d, h:mm a')} –{' '}
                          {format(new Date(slot.endTime), 'h:mm a')}
                        </p>
                      </div>
                      <button onClick={() => handleDeleteBlock(slot.id)}
                        className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <NoteModal
        isOpen={noteModal.open}
        initialNote={noteModal.appt?.notes || ''}
        onClose={() => setNoteModal({ open: false, appt: null })}
        onSave={handleSaveNote}
      />
    </div>
  );
}
