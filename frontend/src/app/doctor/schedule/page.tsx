'use client';

import { useEffect, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { useSchedule } from '@/hooks/useSchedule';
import { WeeklyScheduleEntry, ScheduleException, RescheduledAppointment } from '@/types';
import axios from 'axios';

const DOCTOR_ROLES = ['DOCTOR'] as const;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface ScheduleFormData {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export default function DoctorSchedulePage() {
  return (
    <ProtectedRoute allowedRoles={DOCTOR_ROLES}>
      <ScheduleContent />
    </ProtectedRoute>
  );
}

function ScheduleContent() {
  const {
    schedules,
    exceptions,
    defaultConsultationMinutes,
    isLoading,
    fetchWeeklySchedule,
    fetchExceptions,
    updateWeeklySchedule,
    copyToWeekdays,
    createException,
    deleteException,
    updateConsultationDuration,
  } = useSchedule();

  const [activeTab, setActiveTab] = useState<'weekly' | 'exceptions'>('weekly');
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormData[]>([]);
  const [duration, setDuration] = useState(15);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [exceptionModal, setExceptionModal] = useState<{
    open: boolean;
    date: string;
    startTime: string;
    endTime: string;
    reason: string;
    isAllDay: boolean;
  }>({
    open: false,
    date: '',
    startTime: '',
    endTime: '',
    reason: '',
    isAllDay: false,
  });
  const [rescheduleModal, setRescheduleModal] = useState<{
    open: boolean;
    results: RescheduledAppointment[];
  }>({
    open: false,
    results: [],
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchWeeklySchedule();
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    fetchExceptions(monthStart.toISOString(), monthEnd.toISOString());
  }, [fetchWeeklySchedule, fetchExceptions, currentMonth]);

  useEffect(() => {
    if (schedules.length > 0) {
      const form: ScheduleFormData[] = [];
      for (let day = 0; day < 7; day++) {
        const daySchedules = schedules.filter((s) => s.dayOfWeek === day && s.isActive);
        if (daySchedules.length > 0) {
          for (const s of daySchedules) {
            form.push({
              dayOfWeek: day,
              startTime: s.startTime,
              endTime: s.endTime,
              isActive: true,
            });
          }
        } else {
          form.push({
            dayOfWeek: day,
            startTime: '09:00',
            endTime: '17:00',
            isActive: false,
          });
        }
      }
      setScheduleForm(form);
    }
    setDuration(defaultConsultationMinutes);
  }, [schedules, defaultConsultationMinutes]);

  const getScheduleForDay = (dayOfWeek: number): ScheduleFormData[] => {
    return scheduleForm.filter((s) => s.dayOfWeek === dayOfWeek);
  };

  const updateScheduleEntry = (dayOfWeek: number, index: number, field: keyof ScheduleFormData, value: string | boolean) => {
    setScheduleForm((prev) => {
      const daySchedules = prev.filter((s) => s.dayOfWeek === dayOfWeek);
      const otherSchedules = prev.filter((s) => s.dayOfWeek !== dayOfWeek);

      if (index < daySchedules.length) {
        daySchedules[index] = { ...daySchedules[index], [field]: value };
      }

      return [...otherSchedules, ...daySchedules];
    });
  };

  const addTimeRange = (dayOfWeek: number) => {
    setScheduleForm((prev) => [
      ...prev,
      { dayOfWeek, startTime: '09:00', endTime: '17:00', isActive: true },
    ]);
  };

  const removeTimeRange = (dayOfWeek: number, index: number) => {
    setScheduleForm((prev) => {
      const daySchedules = prev.filter((s) => s.dayOfWeek === dayOfWeek);
      const otherSchedules = prev.filter((s) => s.dayOfWeek !== dayOfWeek);
      daySchedules.splice(index, 1);
      return [...otherSchedules, ...daySchedules];
    });
  };

  const handleSaveSchedule = async () => {
    try {
      const schedulesToSave = scheduleForm
        .filter((s) => s.isActive)
        .map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          isActive: true,
        }));

      await updateWeeklySchedule({
        schedules: schedulesToSave,
        defaultConsultationMinutes: duration,
      });
      showToast('Schedule saved successfully');
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error || 'Failed to save schedule'
        : 'Failed to save schedule';
      showToast(msg, 'error');
    }
  };

  const handleCopyToWeekdays = async () => {
    try {
      await copyToWeekdays();
      showToast('Monday schedule copied to weekdays');
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error || 'Failed to copy schedule'
        : 'Failed to copy schedule';
      showToast(msg, 'error');
    }
  };

  const handleCreateException = async () => {
    try {
      const result = await createException({
        date: exceptionModal.date,
        startTime: exceptionModal.isAllDay ? null : exceptionModal.startTime,
        endTime: exceptionModal.isAllDay ? null : exceptionModal.endTime,
        reason: exceptionModal.reason || undefined,
      });

      setExceptionModal({
        open: false,
        date: '',
        startTime: '',
        endTime: '',
        reason: '',
        isAllDay: false,
      });

      if (result.rescheduledCount > 0) {
        setRescheduleModal({ open: true, results: result.rescheduledAppointments });
        showToast(`${result.rescheduledCount} appointment(s) rescheduled`);
      } else {
        showToast('Exception added successfully');
      }
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error || 'Failed to create exception'
        : 'Failed to create exception';
      showToast(msg, 'error');
    }
  };

  const handleDeleteException = async (id: string) => {
    if (!confirm('Remove this exception?')) return;
    try {
      await deleteException(id);
      showToast('Exception removed');
    } catch (err) {
      showToast('Failed to remove exception', 'error');
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfMonth = monthStart.getDay();

  const getExceptionsForDate = (date: Date): ScheduleException[] => {
    return exceptions.filter((e) => isSameDay(new Date(e.date), date));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />

      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Working Hours</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-0.5">
            Set your weekly schedule and manage exceptions
          </p>
        </div>

        <div className="flex gap-1 mb-5 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
          {(['weekly', 'exceptions'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {tab === 'weekly' ? 'Weekly Schedule' : 'Exceptions & Time Off'}
            </button>
          ))}
        </div>

        {activeTab === 'weekly' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">Default Consultation Duration</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                    Appointments will be booked in slots of this duration
                  </p>
                </div>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {[5, 10, 15, 20, 30, 45, 60, 90, 120].map((d) => (
                    <option key={d} value={d}>
                      {d} min
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">Weekly Schedule</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                    Set your working hours for each day of the week
                  </p>
                </div>
                <button
                  onClick={handleCopyToWeekdays}
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                >
                  Copy Monday to Weekdays
                </button>
              </div>

              <div className="space-y-4">
                {FULL_DAY_NAMES.map((dayName, dayIndex) => {
                  const daySchedules = getScheduleForDay(dayIndex);
                  const hasActive = daySchedules.some((s) => s.isActive);

                  return (
                    <div
                      key={dayIndex}
                      className={`p-4 rounded-xl border ${
                        hasActive ? 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900 dark:text-white w-24">{dayName}</span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={hasActive}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setScheduleForm((prev) => {
                                  const otherDays = prev.filter((s) => s.dayOfWeek !== dayIndex);
                                  if (checked) {
                                    return [
                                      ...otherDays,
                                      {
                                        dayOfWeek: dayIndex,
                                        startTime: '09:00',
                                        endTime: '17:00',
                                        isActive: true,
                                      },
                                    ];
                                  }
                                  return otherDays;
                                });
                              }}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-400">Working day</span>
                          </label>
                        </div>
                        {hasActive && (
                          <button
                            onClick={() => addTimeRange(dayIndex)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                          >
                            + Add time range
                          </button>
                        )}
                      </div>

                      {hasActive && (
                        <div className="space-y-2">
                          {daySchedules.map((schedule, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                              <input
                                type="time"
                                value={schedule.startTime}
                                onChange={(e) =>
                                  updateScheduleEntry(dayIndex, idx, 'startTime', e.target.value)
                                }
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                              <span className="text-gray-400 dark:text-gray-500">to</span>
                              <input
                                type="time"
                                value={schedule.endTime}
                                onChange={(e) =>
                                  updateScheduleEntry(dayIndex, idx, 'endTime', e.target.value)
                                }
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                              {daySchedules.length > 1 && (
                                <button
                                  onClick={() => removeTimeRange(dayIndex, idx)}
                                  className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {!hasActive && (
                        <p className="text-sm text-gray-500 dark:text-gray-500">Not a working day</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                <button
                  onClick={handleSaveSchedule}
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'exceptions' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="font-medium text-gray-900 dark:text-white">{format(currentMonth, 'MMMM yyyy')}</span>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                {DAY_NAMES.map((day) => (
                  <div key={day} className="py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="p-2 min-h-[60px]" />
                ))}
                {days.map((day) => {
                  const dayExceptions = getExceptionsForDate(day);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => {
                        setExceptionModal({
                          open: true,
                          date: format(day, 'yyyy-MM-dd'),
                          startTime: '09:00',
                          endTime: '17:00',
                          reason: '',
                          isAllDay: false,
                        });
                      }}
                      className={`p-2 min-h-[60px] text-left border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        !isSameMonth(day, currentMonth) ? 'text-gray-300 dark:text-gray-600' : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      <span
                        className={`text-sm ${
                          isToday
                            ? 'w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center'
                            : ''
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                      {dayExceptions.length > 0 && (
                        <div className="mt-1">
                          <span className="inline-block w-2 h-2 bg-red-500 rounded-full" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
              <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Upcoming Exceptions</h2>
              {exceptions.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 dark:bg-gray-700 rounded-xl border border-dashed border-gray-200 dark:border-gray-600">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No exceptions scheduled</p>
                  <p className="text-gray-500 dark:text-gray-500 text-xs mt-1">Click a date on the calendar to add one</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {exceptions
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((exception) => (
                      <div
                        key={exception.id}
                        className="p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">
                            {format(new Date(exception.date), 'EEEE, MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                            {exception.startTime && exception.endTime
                              ? `${exception.startTime} - ${exception.endTime}`
                              : 'All day unavailable'}
                            {exception.reason && ` - ${exception.reason}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteException(exception.id)}
                          className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors"
                        >
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

      {exceptionModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Add Exception</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Mark yourself unavailable for a specific date or time range. Any existing appointments
              will be automatically rescheduled.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                <input
                  type="date"
                  value={exceptionModal.date}
                  onChange={(e) =>
                    setExceptionModal((prev) => ({ ...prev, date: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exceptionModal.isAllDay}
                  onChange={(e) =>
                    setExceptionModal((prev) => ({ ...prev, isAllDay: e.target.checked }))
                  }
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">All day unavailable</span>
              </label>

              {!exceptionModal.isAllDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
                    <input
                      type="time"
                      value={exceptionModal.startTime}
                      onChange={(e) =>
                        setExceptionModal((prev) => ({ ...prev, startTime: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
                    <input
                      type="time"
                      value={exceptionModal.endTime}
                      onChange={(e) =>
                        setExceptionModal((prev) => ({ ...prev, endTime: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={exceptionModal.reason}
                  onChange={(e) =>
                    setExceptionModal((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="Holiday, emergency, personal leave..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() =>
                  setExceptionModal({
                    open: false,
                    date: '',
                    startTime: '',
                    endTime: '',
                    reason: '',
                    isAllDay: false,
                  })
                }
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateException}
                disabled={isLoading || !exceptionModal.date}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Adding...' : 'Add Exception'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rescheduleModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Appointments Rescheduled</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              The following appointments were automatically rescheduled due to the exception:
            </p>

            <div className="space-y-2">
              {rescheduleModal.results.map((result, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600">
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{result.patientName}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    <span className="line-through">
                      {format(new Date(result.oldTime), 'MMM d, h:mm a')}
                    </span>
                    {' → '}
                    <span className="text-green-600 dark:text-green-400">
                      {result.newTime ? format(new Date(result.newTime), 'MMM d, h:mm a') : 'No slot found'}
                    </span>
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setRescheduleModal({ open: false, results: [] })}
              className="w-full mt-6 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
