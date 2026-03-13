-- Clinic Management System - Database Schema
-- Generated for Supabase PostgreSQL
-- WARNING: Do NOT include DROP TABLE statements

-- ============================================
-- 1. PROFILES TABLE
-- Stores user profile information linked to Supabase Auth
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'doctor', 'receptionist', 'patient')),
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE profiles IS 'User profiles linked to Supabase Auth users';
COMMENT ON COLUMN profiles.role IS 'User role: admin, doctor, receptionist, or patient';

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. DOCTORS TABLE
-- Stores doctor-specific information
-- ============================================
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    specialty TEXT NOT NULL,
    qualification TEXT,
    experience_years INTEGER CHECK (experience_years >= 0),
    bio TEXT,
    consultation_fee DECIMAL(10, 2) CHECK (consultation_fee >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(profile_id)
);

COMMENT ON TABLE doctors IS 'Doctor-specific details and qualifications';
COMMENT ON COLUMN doctors.profile_id IS 'Foreign key to profiles table (role must be doctor)';

-- Enable RLS on doctors
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. PATIENTS TABLE
-- Stores patient-specific information
-- ============================================
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    blood_group TEXT CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown')),
    address TEXT,
    emergency_contact TEXT,
    medical_history TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(profile_id)
);

COMMENT ON TABLE patients IS 'Patient-specific medical and contact information';
COMMENT ON COLUMN patients.profile_id IS 'Foreign key to profiles table (role must be patient)';

-- Enable RLS on patients
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. SERVICES TABLE
-- Stores clinic services offered
-- ============================================
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    fee DECIMAL(10, 2) NOT NULL CHECK (fee >= 0),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE services IS 'Clinic services and treatments offered';

-- Enable RLS on services
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. DOCTOR_SESSIONS TABLE
-- Stores doctor availability schedule
-- ============================================
CREATE TABLE doctor_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(doctor_id, day_of_week),
    CHECK (end_time > start_time)
);

COMMENT ON TABLE doctor_sessions IS 'Doctor weekly availability schedule (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN doctor_sessions.day_of_week IS 'Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday';

-- Enable RLS on doctor_sessions
ALTER TABLE doctor_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. HOLIDAYS TABLE
-- Stores doctor holidays and time off
-- ============================================
CREATE TABLE holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    holiday_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    is_full_day BOOLEAN DEFAULT TRUE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CHECK (is_full_day = TRUE OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time))
);

COMMENT ON TABLE holidays IS 'Doctor holidays and unavailable time slots';

-- Enable RLS on holidays
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. APPOINTMENTS TABLE
-- Stores patient appointments
-- ============================================
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    visit_type TEXT NOT NULL CHECK (visit_type IN ('consultation', 'follow_up', 'emergency', 'routine_checkup')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show')),
    description TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CHECK (end_time > start_time)
);

COMMENT ON TABLE appointments IS 'Patient appointments with doctors';
COMMENT ON COLUMN appointments.status IS 'Appointment status: pending, confirmed, checked_in, completed, cancelled, no_show';
COMMENT ON COLUMN appointments.visit_type IS 'Type of visit: consultation, follow_up, emergency, routine_checkup';

-- Enable RLS on appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TRIGGER: Auto-create profile on user signup
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, role, first_name, last_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION handle_new_user() IS 'Automatically creates a profile when a new user signs up via Supabase Auth';

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================
-- RLS POLICIES (Prototype: Allow all authenticated users)
-- ============================================

-- Profiles policies
CREATE POLICY "Allow all authenticated operations on profiles"
    ON profiles FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Doctors policies
CREATE POLICY "Allow all authenticated operations on doctors"
    ON doctors FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Patients policies
CREATE POLICY "Allow all authenticated operations on patients"
    ON patients FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Services policies
CREATE POLICY "Allow all authenticated operations on services"
    ON services FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Doctor_sessions policies
CREATE POLICY "Allow all authenticated operations on doctor_sessions"
    ON doctor_sessions FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Holidays policies
CREATE POLICY "Allow all authenticated operations on holidays"
    ON holidays FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Appointments policies
CREATE POLICY "Allow all authenticated operations on appointments"
    ON appointments FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
