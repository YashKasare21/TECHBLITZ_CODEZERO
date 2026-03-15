'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Patient, Appointment, Doctor, TimeSlot } from '@/types';
import { patientsApi, authApi, scheduleApi } from '@/services/api';
import { format, addMinutes, parse, isBefore, startOfToday } from 'date-fns';
import axios from 'axios';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    patientId: string;
    doctorId: string;
    startTime: string;
    duration: number;
    notes?: string;
  }) => Promise<void>;
  rescheduleTarget?: Appointment | null;
  prefillStart?: Date | null;
  prefillEnd?: Date | null;
}

const DURATIONS = [15, 30, 45, 60];

export default function AppointmentModal({
  isOpen,
  onClose,
  onSubmit,
  rescheduleTarget,
  prefillStart,
  prefillEnd,
}: Props) {
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newPatientData, setNewPatientData] = useState({ name: '', phone: '', email: '' });

  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [isWorkingDay, setIsWorkingDay] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [outsideHoursWarning, setOutsideHoursWarning] = useState(false);

  const isReschedule = !!rescheduleTarget;

  const searchPatients = useCallback(async (q: string) => {
    if (q.length < 2) {
      setPatientResults([]);
      return;
    }
    try {
      const res = await patientsApi.search(q);
      setPatientResults(res.data.data);
    } catch {
      setPatientResults([]);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchPatients(patientQuery), 300);
    return () => clearTimeout(t);
  }, [patientQuery, searchPatients]);

  useEffect(() => {
    if (!isOpen) return;
    authApi.getDoctors().then((res) => {
      const docs: Doctor[] = res.data.data;
      setDoctors(docs);
      if (docs.length > 0) setSelectedDoctor(docs[0]);
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const initDate = prefillStart || (rescheduleTarget ? new Date(rescheduleTarget.startTime) : new Date());
    setDateStr(format(initDate, 'yyyy-MM-dd'));
    setTimeStr(format(initDate, 'HH:mm'));

    if (rescheduleTarget) {
      const dur = Math.round(
        (new Date(rescheduleTarget.endTime).getTime() - new Date(rescheduleTarget.startTime).getTime()) / 60000,
      );
      setDuration(dur);
      setSelectedPatient(rescheduleTarget.patient as Patient);
      setNotes(rescheduleTarget.notes || '');
    } else if (prefillEnd && prefillStart) {
      const dur = Math.round((prefillEnd.getTime() - prefillStart.getTime()) / 60000);
      const snapped = DURATIONS.includes(dur)
        ? dur
        : DURATIONS.reduce((a, b) => (Math.abs(b - dur) < Math.abs(a - dur) ? b : a));
      setDuration(snapped);
    }
  }, [isOpen, rescheduleTarget, prefillStart, prefillEnd]);

  const fetchAvailableSlots = useCallback(async (doctorId: string, date: string, dur: number) => {
    if (!doctorId || !date) {
      setAvailableSlots([]);
      setIsWorkingDay(true);
      return;
    }

    setLoadingSlots(true);
    try {
      const res = await scheduleApi.getAvailableSlots(date, dur);
      setAvailableSlots(res.data.data.slots);
      setIsWorkingDay(res.data.data.isWorkingDay);
    } catch {
      setAvailableSlots([]);
      setIsWorkingDay(true);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDoctor?.id && dateStr) {
      fetchAvailableSlots(selectedDoctor.id, dateStr, duration);
    }
  }, [selectedDoctor?.id, dateStr, duration, fetchAvailableSlots]);

  const reset = () => {
    setPatientQuery('');
    setPatientResults([]);
    setSelectedPatient(null);
    setDateStr('');
    setTimeStr('');
    setDuration(30);
    setNotes('');
    setError('');
    setShowNewPatient(false);
    setNewPatientData({ name: '', phone: '', email: '' });
    setAvailableSlots([]);
    setIsWorkingDay(true);
    setShowCustomTime(false);
    setOutsideHoursWarning(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    if (!slot.available) return;
    setTimeStr(slot.time);
    setOutsideHoursWarning(false);
  };

  const handleCustomTimeChange = (time: string) => {
    setTimeStr(time);
    setOutsideHoursWarning(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      setError('Please select a patient');
      return;
    }
    if (!selectedDoctor) {
      setError('No doctor available');
      return;
    }
    if (!dateStr || !timeStr) {
      setError('Please select date and time');
      return;
    }

    const selectedSlot = availableSlots.find((s) => s.time === timeStr);
    if (selectedSlot && !selectedSlot.available) {
      setError('This time slot is not available');
      return;
    }

    if (showCustomTime && !outsideHoursWarning) {
      const selectedTime = parse(timeStr, 'HH:mm', new Date());
      const matchingSlot = availableSlots.find(
        (s) => s.time === timeStr || s.time === format(selectedTime, 'HH:mm'),
      );
      if (!matchingSlot || !matchingSlot.available) {
        setOutsideHoursWarning(true);
        return;
      }
    }

    if (outsideHoursWarning) {
      setOutsideHoursWarning(false);
    }

    setError('');
    setSubmitting(true);
    try {
      const startTime = new Date(`${dateStr}T${timeStr}:00`).toISOString();
      await onSubmit({
        patientId: selectedPatient.id,
        doctorId: selectedDoctor.id,
        startTime,
        duration,
        notes: notes || undefined,
      });
      reset();
      onClose();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to book appointment');
      } else {
        setError('Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePatient = async () => {
    if (!newPatientData.name || !newPatientData.phone) {
      setError('Name and phone are required');
      return;
    }
    try {
      const res = await patientsApi.create(newPatientData);
      const created: Patient = res.data.data;
      setSelectedPatient(created);
      setShowNewPatient(false);
      setPatientQuery(created.name);
      setPatientResults([]);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to create patient');
      }
    }
  };

  const previewEnd = dateStr && timeStr ? addMinutes(new Date(`${dateStr}T${timeStr}`), duration) : null;

  const todayStr = format(startOfToday(), 'yyyy-MM-dd');
  const isToday = dateStr === todayStr;

  const filteredSlots = isToday
    ? availableSlots.filter((slot) => {
        const slotTime = parse(slot.time, 'HH:mm', new Date());
        return !isBefore(slotTime, new Date());
      })
    : availableSlots;

  const morningSlots = filteredSlots.filter((s) => {
    const h = parseInt(s.time.split(':')[0], 10);
    return h < 12;
  });
  const afternoonSlots = filteredSlots.filter((s) => {
    const h = parseInt(s.time.split(':')[0], 10);
    return h >= 12 && h < 17;
  });
  const eveningSlots = filteredSlots.filter((s) => {
    const h = parseInt(s.time.split(':')[0], 10);
    return h >= 17;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isReschedule ? 'Reschedule Appointment' : 'Book Appointment'}
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">{error}</div>
          )}

          {outsideHoursWarning && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-300 text-sm">
              <p className="font-medium">Booking outside working hours</p>
              <p className="text-xs mt-1">This time is outside the doctor&apos;s regular schedule. Click Book again to confirm.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Patient</label>
              {selectedPatient ? (
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-200 text-sm">{selectedPatient.name}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">{selectedPatient.phone}</p>
                  </div>
                  {!isReschedule && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPatient(null);
                        setPatientQuery('');
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                    >
                      Change
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    placeholder="Search by name or phone..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  {patientResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {patientResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedPatient(p);
                            setPatientQuery(p.name);
                            setPatientResults([]);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-sm border-b border-gray-100 dark:border-gray-600 last:border-0 text-gray-900 dark:text-white"
                        >
                          <span className="font-medium">{p.name}</span>
                          <span className="text-gray-400 dark:text-gray-500 ml-2 text-xs">{p.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowNewPatient(!showNewPatient)}
                    className="mt-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    + Register new patient
                  </button>
                </div>
              )}
            </div>

            {showNewPatient && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-600">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">New Patient</p>
                <input
                  placeholder="Full name *"
                  value={newPatientData.name}
                  onChange={(e) => setNewPatientData((d) => ({ ...d, name: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                <input
                  placeholder="Phone *"
                  value={newPatientData.phone}
                  onChange={(e) => setNewPatientData((d) => ({ ...d, phone: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                <input
                  placeholder="Email (optional)"
                  value={newPatientData.email}
                  onChange={(e) => setNewPatientData((d) => ({ ...d, email: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button
                  type="button"
                  onClick={handleCreatePatient}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                >
                  Create & Select
                </button>
              </div>
            )}

            {doctors.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Doctor</label>
                <select
                  value={selectedDoctor?.id || ''}
                  onChange={(e) => setSelectedDoctor(doctors.find((d) => d.id === e.target.value) || null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Date</label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Duration</label>
              <div className="flex gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      duration === d
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'
                    }`}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>

            {dateStr && selectedDoctor && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Time</label>
                  <button
                    type="button"
                    onClick={() => setShowCustomTime(!showCustomTime)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {showCustomTime ? 'Show slots' : 'Custom time'}
                  </button>
                </div>

                {!isWorkingDay && !showCustomTime && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 text-center">
                    This is not a working day for the doctor.{' '}
                    <button
                      type="button"
                      onClick={() => setShowCustomTime(true)}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Book anyway
                    </button>
                  </div>
                )}

                {loadingSlots && (
                  <div className="p-4 text-center text-sm text-gray-600 dark:text-gray-400">Loading available slots...</div>
                )}

                {!loadingSlots && isWorkingDay && !showCustomTime && filteredSlots.length > 0 && (
                  <div className="space-y-3">
                    {morningSlots.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5 font-medium">Morning</p>
                        <div className="flex flex-wrap gap-1.5">
                          {morningSlots.map((slot) => (
                            <button
                              key={slot.time}
                              type="button"
                              onClick={() => handleSlotSelect(slot)}
                              disabled={!slot.available}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                timeStr === slot.time
                                  ? 'bg-blue-600 text-white'
                                  : slot.available
                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed line-through'
                              }`}
                            >
                              {format(parse(slot.time, 'HH:mm', new Date()), 'h:mm a')}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {afternoonSlots.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5 font-medium">Afternoon</p>
                        <div className="flex flex-wrap gap-1.5">
                          {afternoonSlots.map((slot) => (
                            <button
                              key={slot.time}
                              type="button"
                              onClick={() => handleSlotSelect(slot)}
                              disabled={!slot.available}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                timeStr === slot.time
                                  ? 'bg-blue-600 text-white'
                                  : slot.available
                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed line-through'
                              }`}
                            >
                              {format(parse(slot.time, 'HH:mm', new Date()), 'h:mm a')}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {eveningSlots.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5 font-medium">Evening</p>
                        <div className="flex flex-wrap gap-1.5">
                          {eveningSlots.map((slot) => (
                            <button
                              key={slot.time}
                              type="button"
                              onClick={() => handleSlotSelect(slot)}
                              disabled={!slot.available}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                timeStr === slot.time
                                  ? 'bg-blue-600 text-white'
                                  : slot.available
                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed line-through'
                              }`}
                            >
                              {format(parse(slot.time, 'HH:mm', new Date()), 'h:mm a')}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {showCustomTime && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <p className="text-xs text-yellow-800 dark:text-yellow-300 mb-2">
                      Booking outside regular hours may not be ideal. The doctor may not be available.
                    </p>
                    <input
                      type="time"
                      value={timeStr}
                      onChange={(e) => handleCustomTimeChange(e.target.value)}
                      step="900"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                )}

                {!loadingSlots && isWorkingDay && filteredSlots.length === 0 && !showCustomTime && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 text-center">
                    No available slots for this date.{' '}
                    <button
                      type="button"
                      onClick={() => setShowCustomTime(true)}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Try custom time
                    </button>
                  </div>
                )}

                {timeStr && previewEnd && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    Selected: {format(parse(timeStr, 'HH:mm', new Date()), 'h:mm a')} -{' '}
                    {format(previewEnd, 'h:mm a')}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Notes <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Reason for visit, special instructions..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm outline-none resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium text-sm transition-colors"
              >
                {submitting ? 'Saving...' : isReschedule ? 'Reschedule' : 'Book Appointment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
