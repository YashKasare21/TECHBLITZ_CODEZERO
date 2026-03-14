'use client';

import { Appointment } from '@/types';
import { format } from 'date-fns';

const STATUS_STYLES = {
  SCHEDULED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  COMPLETED: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  CANCELLED: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  RESCHEDULED: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
};

interface Props {
  appointment: Appointment;
  onCancel?: (id: string) => void;
  onComplete?: (id: string) => void;
  onReschedule?: (appointment: Appointment) => void;
  onAddNote?: (appointment: Appointment) => void;
  showActions?: boolean;
}

export default function AppointmentCard({
  appointment,
  onCancel,
  onComplete,
  onReschedule,
  onAddNote,
  showActions = true,
}: Props) {
  const { patient, startTime, endTime, status, notes, doctor } = appointment;
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMins = Math.round((end.getTime() - start.getTime()) / 60000);

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm transition-shadow hover:shadow-md ${
        status === 'CANCELLED' ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400">{durationMins} min</span>
          </div>

          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{patient.name}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{patient.phone}</p>
          {patient.email && <p className="text-xs text-gray-500 dark:text-gray-500">{patient.email}</p>}

          <div className="mt-2 flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
            <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{format(start, 'h:mm a')}</span>
            <span className="text-gray-400 dark:text-gray-500">–</span>
            <span>{format(end, 'h:mm a')}</span>
          </div>

          {doctor && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Dr. {doctor.name.replace(/^Dr\.\s*/i, '')}</p>
          )}

          {notes && (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded px-2 py-1 italic truncate">
              {notes}
            </p>
          )}
        </div>
      </div>

      {showActions && status !== 'CANCELLED' && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 dark:border-gray-700 pt-3">
          {status === 'SCHEDULED' && onComplete && (
            <button
              onClick={() => onComplete(appointment.id)}
              className="text-xs bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              Mark Complete
            </button>
          )}
          {status === 'SCHEDULED' && onReschedule && (
            <button
              onClick={() => onReschedule(appointment)}
              className="text-xs bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              Reschedule
            </button>
          )}
          {onAddNote && (
            <button
              onClick={() => onAddNote(appointment)}
              className="text-xs bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              {notes ? 'Edit Note' : 'Add Note'}
            </button>
          )}
          {status === 'SCHEDULED' && onCancel && (
            <button
              onClick={() => onCancel(appointment.id)}
              className="text-xs bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg font-medium transition-colors ml-auto"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
