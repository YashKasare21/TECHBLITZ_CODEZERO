/**
 * Clinic Management System - TypeScript Types
 * 
 * This file contains all TypeScript types that match the Supabase database schema.
 * These types are the contract between the backend and frontend.
 */

// ============================================
// 1. ENUM TYPES
// ============================================

/** User roles in the system */
export type UserRole = "admin" | "doctor" | "receptionist" | "patient";

/** Appointment status lifecycle */
export type AppointmentStatus = 
  | "pending" 
  | "confirmed" 
  | "checked_in" 
  | "completed" 
  | "cancelled" 
  | "no_show";

/** Patient gender options */
export type Gender = "male" | "female" | "other" | "prefer_not_to_say";

/** Blood group types */
export type BloodGroup = 
  | "A+" 
  | "A-" 
  | "B+" 
  | "B-" 
  | "O+" 
  | "O-" 
  | "AB+" 
  | "AB-"
  | "unknown";

/** Day of week (0 = Sunday, 6 = Saturday) */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Type of medical visit */
export type VisitType = "consultation" | "follow_up" | "emergency" | "routine_checkup";

// ============================================
// 2. DATABASE ROW TYPES (Exact match to SQL schema)
// ============================================

/** Profile table - linked to Supabase Auth users */
export interface Profile {
  id: string; // UUID, references auth.users(id)
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string; // TIMESTAMPTZ
}

/** Doctor table - doctor-specific information */
export interface Doctor {
  id: string; // UUID
  profile_id: string; // UUID, references profiles(id)
  specialty: string;
  qualification: string | null;
  experience_years: number | null;
  bio: string | null;
  consultation_fee: number | null; // DECIMAL
  created_at: string; // TIMESTAMPTZ
}

/** Patient table - patient medical information */
export interface Patient {
  id: string; // UUID
  profile_id: string; // UUID, references profiles(id)
  date_of_birth: string | null; // DATE
  gender: Gender | null;
  blood_group: BloodGroup | null;
  address: string | null;
  emergency_contact: string | null;
  medical_history: string | null;
  created_at: string; // TIMESTAMPTZ
}

/** Service table - clinic services offered */
export interface Service {
  id: string; // UUID
  name: string;
  description: string | null;
  duration_minutes: number;
  fee: number; // DECIMAL
  is_active: boolean;
  created_at: string; // TIMESTAMPTZ
}

/** DoctorSession table - doctor weekly availability */
export interface DoctorSession {
  id: string; // UUID
  doctor_id: string; // UUID, references doctors(id)
  day_of_week: DayOfWeek;
  start_time: string; // TIME
  end_time: string; // TIME
  is_available: boolean;
  created_at: string; // TIMESTAMPTZ
}

/** Holiday table - doctor holidays and time off */
export interface Holiday {
  id: string; // UUID
  doctor_id: string; // UUID, references doctors(id)
  holiday_date: string; // DATE
  start_time: string | null; // TIME
  end_time: string | null; // TIME
  is_full_day: boolean;
  reason: string | null;
  created_at: string; // TIMESTAMPTZ
}

/** Appointment table - patient appointments */
export interface Appointment {
  id: string; // UUID
  patient_id: string; // UUID, references patients(id)
  doctor_id: string; // UUID, references doctors(id)
  appointment_date: string; // DATE
  start_time: string; // TIME
  end_time: string; // TIME
  visit_type: VisitType;
  status: AppointmentStatus;
  description: string | null;
  created_by: string | null; // UUID, references profiles(id)
  created_at: string; // TIMESTAMPTZ
}

// ============================================
// 3. JOINED/EXTENDED TYPES (with foreign key data)
// ============================================

/** Profile data included in joined types */
export interface ProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: UserRole;
}

/** Doctor with profile information */
export interface DoctorWithProfile extends Doctor {
  profile: ProfileData;
}

/** Patient with profile information */
export interface PatientWithProfile extends Patient {
  profile: ProfileData;
}

/** Appointment with doctor and patient details */
export interface AppointmentWithDetails extends Appointment {
  doctor: DoctorWithProfile;
  patient: PatientWithProfile;
  creator: ProfileData | null;
}

// ============================================
// 4. FORM INPUT TYPES (for server actions)
// ============================================

/** Input for creating a new appointment */
export interface CreateAppointmentInput {
  patient_id: string;
  doctor_id: string;
  appointment_date: string; // ISO date string (YYYY-MM-DD)
  start_time: string; // TIME format (HH:MM)
  end_time: string; // TIME format (HH:MM)
  visit_type: VisitType;
  description?: string | null;
}

/** Input for updating an existing appointment */
export interface UpdateAppointmentInput {
  id: string;
  patient_id?: string;
  doctor_id?: string;
  appointment_date?: string;
  start_time?: string;
  end_time?: string;
  visit_type?: VisitType;
  status?: AppointmentStatus;
  description?: string | null;
}

/** Input for creating a new patient */
export interface CreatePatientInput {
  email: string;
  password: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  date_of_birth?: string | null; // ISO date string
  gender?: Gender | null;
  blood_group?: BloodGroup | null;
  address?: string | null;
  emergency_contact?: string | null;
  medical_history?: string | null;
}

/** Input for creating a new doctor */
export interface CreateDoctorInput {
  email: string;
  password: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  specialty: string;
  qualification?: string | null;
  experience_years?: number | null;
  bio?: string | null;
  consultation_fee?: number | null;
}

/** Input for creating a doctor session */
export interface CreateDoctorSessionInput {
  doctor_id: string;
  day_of_week: DayOfWeek;
  start_time: string; // TIME format (HH:MM)
  end_time: string; // TIME format (HH:MM)
  is_available?: boolean;
}

/** Input for creating a holiday */
export interface CreateHolidayInput {
  doctor_id: string;
  holiday_date: string; // ISO date string (YYYY-MM-DD)
  start_time?: string | null; // TIME format (HH:MM)
  end_time?: string | null; // TIME format (HH:MM)
  is_full_day?: boolean;
  reason?: string | null;
}

/** Input for creating a service */
export interface CreateServiceInput {
  name: string;
  description?: string | null;
  duration_minutes: number;
  fee: number;
  is_active?: boolean;
}

/** Booking slot for appointment scheduling */
export interface BookingSlot {
  date: string; // ISO format YYYY-MM-DD
  startTime: string; // TIME format (HH:MM)
  endTime: string; // TIME format (HH:MM)
  isAvailable: boolean;
}

/** Input for upserting a doctor session (Phase 6) */
export interface UpsertDoctorSession {
  doctor_id: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

// ============================================
// 5. API RESPONSE TYPES
// ============================================

/** Standard action result wrapper for server actions */
export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Pagination metadata for list queries */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Paginated response wrapper */
export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

// ============================================
// 6. SUPABASE DATABASE TYPE (for client typing)
// ============================================

/**
 * Complete Database type for Supabase client
 * Use this as the generic when creating Supabase clients
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
      doctors: {
        Row: Doctor;
        Insert: Omit<Doctor, 'id' | 'created_at'>;
        Update: Partial<Omit<Doctor, 'id' | 'created_at'>>;
      };
      patients: {
        Row: Patient;
        Insert: Omit<Patient, 'id' | 'created_at'>;
        Update: Partial<Omit<Patient, 'id' | 'created_at'>>;
      };
      services: {
        Row: Service;
        Insert: Omit<Service, 'id' | 'created_at'>;
        Update: Partial<Omit<Service, 'id' | 'created_at'>>;
      };
      doctor_sessions: {
        Row: DoctorSession;
        Insert: Omit<DoctorSession, 'id' | 'created_at'>;
        Update: Partial<Omit<DoctorSession, 'id' | 'created_at'>>;
      };
      holidays: {
        Row: Holiday;
        Insert: Omit<Holiday, 'id' | 'created_at'>;
        Update: Partial<Omit<Holiday, 'id' | 'created_at'>>;
      };
      appointments: {
        Row: Appointment;
        Insert: Omit<Appointment, 'id' | 'created_at'>;
        Update: Partial<Omit<Appointment, 'id' | 'created_at'>>;
      };
    };
  };
}
