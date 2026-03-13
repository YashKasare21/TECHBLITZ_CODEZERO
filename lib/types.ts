export type UserRole = "receptionist" | "doctor" | "patient";

export type AppointmentStatus =
  | "pending"
  | "booked"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show";

export type VisitType = "in_person" | "virtual";

export type BookingChannel = "web" | "whatsapp" | "walk_in";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Doctor {
  id: string;
  profile_id: string;
  specialization: string;
  bio: string | null;
  consultation_duration_mins: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface DoctorSession {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_mins: number;
  is_active: boolean;
  created_at: string;
}

export interface BlockedDate {
  id: string;
  doctor_id: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Patient {
  id: string;
  profile_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  dob: string | null;
  gender: string | null;
  blood_group: string | null;
  address: string | null;
  patient_uid: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  doctor_id: string;
  patient_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  visit_type: VisitType;
  chief_complaint: string | null;
  notes: string | null;
  booked_via: BookingChannel;
  booked_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  doctor?: Doctor;
  patient?: Patient;
}

export interface AppointmentReminder {
  id: string;
  appointment_id: string;
  remind_at: string;
  whatsapp_sent: boolean;
  email_sent: boolean;
  sent_at: string | null;
}

export interface TimeSlot {
  start_time: string;
  end_time: string;
  available: boolean;
}
