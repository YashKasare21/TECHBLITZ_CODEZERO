export type Role = 'DOCTOR' | 'RECEPTIONIST';
export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  defaultConsultationMinutes?: number;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  createdAt: string;
  _count?: { appointments: number };
}

export interface Doctor {
  id: string;
  name: string;
  email: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes?: string | null;
  rescheduledFrom?: string | null;
  rescheduleReason?: string | null;
  createdAt: string;
  patient: Pick<Patient, 'id' | 'name' | 'phone' | 'email'>;
  doctor: Pick<Doctor, 'id' | 'name'>;
}

export interface BlockedSlot {
  id: string;
  doctorId: string;
  startTime: string;
  endTime: string;
  reason?: string | null;
  createdAt: string;
}

export interface DoctorSchedule {
  appointments: Appointment[];
  blockedSlots: BlockedSlot[];
}

export interface WeeklyScheduleEntry {
  id: string;
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface WeeklyScheduleResponse {
  schedules: WeeklyScheduleEntry[];
  defaultConsultationMinutes: number;
}

export interface ScheduleException {
  id: string;
  doctorId: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
  createdAt: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface AvailableSlotsResponse {
  slots: TimeSlot[];
  isWorkingDay: boolean;
}

export interface RescheduledAppointment {
  appointmentId: string;
  patientName: string;
  oldTime: string;
  newTime: string | null;
  success: boolean;
}

export interface CreateExceptionResponse {
  exception: ScheduleException;
  rescheduledCount: number;
  rescheduledAppointments: RescheduledAppointment[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    type: 'appointment' | 'blocked';
    status?: AppointmentStatus;
    patientName?: string;
    patientPhone?: string;
    notes?: string;
    reason?: string;
  };
}
