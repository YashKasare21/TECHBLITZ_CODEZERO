-- ClinicOS Full Schema
-- Run this in Supabase SQL Editor as a single migration

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE user_role AS ENUM ('receptionist', 'doctor', 'patient');
CREATE TYPE appointment_status AS ENUM ('pending', 'booked', 'checked_in', 'checked_out', 'cancelled', 'no_show');
CREATE TYPE visit_type AS ENUM ('in_person', 'virtual');
CREATE TYPE booking_channel AS ENUM ('web', 'whatsapp', 'walk_in');

-- =============================================================================
-- SEQUENCES
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS patient_uid_seq START 1;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _role user_role := 'patient';
  _raw_role text;
BEGIN
  _raw_role := NEW.raw_user_meta_data->>'role';
  IF _raw_role IS NOT NULL AND _raw_role != '' THEN
    _role := _raw_role::user_role;
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    _role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TABLES
-- =============================================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'patient',
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  specialization TEXT NOT NULL,
  bio TEXT,
  consultation_duration_mins INT NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE doctor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration_mins INT NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (start_time < end_time),
  CONSTRAINT unique_doctor_day_time UNIQUE (doctor_id, day_of_week, start_time)
);

CREATE TABLE blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (start_date <= end_date)
);

CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  dob DATE,
  gender TEXT,
  blood_group TEXT,
  address TEXT,
  patient_uid TEXT NOT NULL UNIQUE DEFAULT ('PT-' || LPAD(nextval('patient_uid_seq')::text, 4, '0')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status appointment_status NOT NULL DEFAULT 'pending',
  visit_type visit_type NOT NULL DEFAULT 'in_person',
  chief_complaint TEXT,
  notes TEXT,
  booked_via booking_channel NOT NULL DEFAULT 'web',
  booked_by UUID REFERENCES profiles(id),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES profiles(id),
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_appointment_time CHECK (start_time < end_time),
  CONSTRAINT unique_doctor_slot UNIQUE (doctor_id, appointment_date, start_time)
);

CREATE TABLE appointment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  remind_at TIMESTAMPTZ NOT NULL,
  whatsapp_sent BOOLEAN NOT NULL DEFAULT false,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_appointments_doctor_date ON appointments(doctor_id, appointment_date);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_date_status ON appointments(appointment_date, status);
CREATE INDEX idx_doctor_sessions_doctor_day ON doctor_sessions(doctor_id, day_of_week);
CREATE INDEX idx_blocked_dates_doctor ON blocked_dates(doctor_id, start_date, end_date);
CREATE INDEX idx_reminders_pending ON appointment_reminders(remind_at) WHERE whatsapp_sent = false;
CREATE INDEX idx_patients_uid ON patients(patient_uid);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_profiles_role ON profiles(role);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_doctors_updated_at
  BEFORE UPDATE ON doctors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES
CREATE POLICY "Users can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- DOCTORS
CREATE POLICY "Anyone can read active doctors"
  ON doctors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Receptionists can manage doctors"
  ON doctors FOR ALL
  TO authenticated
  USING (get_user_role() = 'receptionist')
  WITH CHECK (get_user_role() = 'receptionist');

CREATE POLICY "Doctors can update own record"
  ON doctors FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- DOCTOR SESSIONS
CREATE POLICY "Anyone can read sessions"
  ON doctor_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Receptionists can manage sessions"
  ON doctor_sessions FOR ALL
  TO authenticated
  USING (get_user_role() = 'receptionist')
  WITH CHECK (get_user_role() = 'receptionist');

CREATE POLICY "Doctors can manage own sessions"
  ON doctor_sessions FOR ALL
  TO authenticated
  USING (
    doctor_id IN (SELECT id FROM doctors WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    doctor_id IN (SELECT id FROM doctors WHERE profile_id = auth.uid())
  );

-- BLOCKED DATES
CREATE POLICY "Authenticated can read blocked dates"
  ON blocked_dates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Receptionists can manage blocked dates"
  ON blocked_dates FOR ALL
  TO authenticated
  USING (get_user_role() = 'receptionist')
  WITH CHECK (get_user_role() = 'receptionist');

CREATE POLICY "Doctors can manage own blocked dates"
  ON blocked_dates FOR ALL
  TO authenticated
  USING (
    doctor_id IN (SELECT id FROM doctors WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    doctor_id IN (SELECT id FROM doctors WHERE profile_id = auth.uid())
  );

-- PATIENTS
CREATE POLICY "Receptionist and doctors can read patients"
  ON patients FOR SELECT
  TO authenticated
  USING (get_user_role() IN ('receptionist', 'doctor'));

CREATE POLICY "Receptionists can manage patients"
  ON patients FOR ALL
  TO authenticated
  USING (get_user_role() = 'receptionist')
  WITH CHECK (get_user_role() = 'receptionist');

-- APPOINTMENTS
CREATE POLICY "Receptionists can do everything with appointments"
  ON appointments FOR ALL
  TO authenticated
  USING (get_user_role() = 'receptionist')
  WITH CHECK (get_user_role() = 'receptionist');

CREATE POLICY "Doctors can read own appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    doctor_id IN (SELECT id FROM doctors WHERE profile_id = auth.uid())
  );

CREATE POLICY "Doctors can update own appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    doctor_id IN (SELECT id FROM doctors WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    doctor_id IN (SELECT id FROM doctors WHERE profile_id = auth.uid())
  );

-- APPOINTMENT REMINDERS
CREATE POLICY "Authenticated can read reminders"
  ON appointment_reminders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Receptionists can manage reminders"
  ON appointment_reminders FOR ALL
  TO authenticated
  USING (get_user_role() = 'receptionist')
  WITH CHECK (get_user_role() = 'receptionist');

-- =============================================================================
-- REALTIME (enable for appointments table)
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
