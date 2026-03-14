'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import AppointmentCard from '@/components/AppointmentCard';
import AppointmentModal from '@/components/AppointmentModal';
import { patientsApi } from '@/services/api';
import { useAppointments } from '@/hooks/useAppointments';
import { usePatients } from '@/hooks/usePatients';
import { Appointment } from '@/types';
import axios from 'axios';

interface PatientWithHistory {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  createdAt: string;
  appointments: Appointment[];
}

const RECEPTIONIST_ROLES = ['RECEPTIONIST'] as const;

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProtectedRoute allowedRoles={RECEPTIONIST_ROLES}>
      <PatientDetailContent id={id} />
    </ProtectedRoute>
  );
}

function PatientDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const [patient, setPatient] = useState<PatientWithHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [editError, setEditError] = useState('');
  const [toast, setToast] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const { updatePatient } = usePatients();
  const { createAppointment, updateAppointment, cancelAppointment } = useAppointments();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadPatient = async () => {
    setLoading(true);
    try {
      const res = await patientsApi.getById(id);
      const data = res.data.data as PatientWithHistory;
      setPatient(data);
      setEditForm({ name: data.name, phone: data.phone, email: data.email || '', notes: data.notes || '' });
    } catch {
      router.push('/patients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPatient(); }, [id]);

  const handleSaveEdit = async () => {
    setEditError('');
    try {
      await updatePatient(id, editForm);
      await loadPatient();
      setEditMode(false);
      showToast('Patient updated');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) setEditError(err.response?.data?.error || 'Update failed');
    }
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
    loadPatient();
  };

  const handleCancel = async (apptId: string) => {
    if (!confirm('Cancel this appointment?')) return;
    await cancelAppointment(apptId);
    showToast('Appointment cancelled');
    loadPatient();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!patient) return null;

  const appointments = patient.appointments || [];
  const upcoming = appointments.filter((a) => new Date(a.startTime) >= new Date() && a.status === 'SCHEDULED');
  const past = appointments.filter((a) => new Date(a.startTime) < new Date() || a.status !== 'SCHEDULED');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />

      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium bg-green-600">
          {toast}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-5">
          <Link href="/patients" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Patients</Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white font-medium">{patient.name}</span>
        </div>

        {/* Patient Profile Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 mb-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-700 dark:text-blue-300 text-xl font-bold">{patient.name.charAt(0)}</span>
              </div>
              {!editMode ? (
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">{patient.name}</h1>
                  <p className="text-gray-600 dark:text-gray-400">{patient.phone}</p>
                  {patient.email && <p className="text-sm text-gray-500 dark:text-gray-500">{patient.email}</p>}
                  {patient.notes && (
                    <p className="mt-1 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded inline-block">
                      {patient.notes}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    Registered {format(new Date(patient.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {editError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{editError}</p>
                  )}
                  <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Name" className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  <input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="Phone" className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  <input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="Email" className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  <input value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Medical notes" className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleSaveEdit} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">Save</button>
                    <button onClick={() => setEditMode(false)} className="text-sm border border-gray-300 dark:border-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {!editMode && (
              <div className="flex gap-2">
                <button onClick={() => setEditMode(true)}
                  className="text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Edit
                </button>
                <button onClick={() => { setRescheduleTarget(null); setModalOpen(true); }}
                  className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
                  Book Appointment
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Appointments */}
        <div className="space-y-5">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-3">
                Upcoming ({upcoming.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {upcoming.map((appt) => (
                  <AppointmentCard
                    key={appt.id}
                    appointment={appt}
                    onCancel={handleCancel}
                    onReschedule={(a) => { setRescheduleTarget(a); setModalOpen(true); }}
                  />
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-3">
                History ({past.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {past.map((appt) => (
                  <AppointmentCard
                    key={appt.id}
                    appointment={appt}
                    showActions={false}
                  />
                ))}
              </div>
            </div>
          )}

          {appointments.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400 text-sm">No appointment history</p>
            </div>
          )}
        </div>
      </div>

      <AppointmentModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setRescheduleTarget(null); }}
        onSubmit={handleBook}
        rescheduleTarget={rescheduleTarget}
      />
    </div>
  );
}
